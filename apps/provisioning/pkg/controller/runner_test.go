package controller

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func newTestRunner(drainTimeout time.Duration, process func(ctx context.Context, key string) error) *Runner {
	return NewRunner(RunnerConfig{
		Name:         "test-runner",
		DrainTimeout: drainTimeout,
		Process:      process,
	})
}

func TestRunner_Run_DrainWaitsForInFlight(t *testing.T) {
	processCh := make(chan struct{})
	processingStarted := make(chan struct{})
	var processed atomic.Bool

	r := newTestRunner(5*time.Second, func(_ context.Context, _ string) error {
		close(processingStarted)
		<-processCh
		processed.Store(true)
		return nil
	})

	r.Enqueue("test/repo")

	ctx, cancel := context.WithCancel(t.Context())
	runDone := make(chan struct{})
	go func() {
		r.Run(ctx, 1, func() {}, func() {})
		close(runDone)
	}()

	// Wait until the worker has actually picked up the item
	<-processingStarted

	// Cancel context to trigger shutdown
	cancel()

	// Run should NOT return yet because item is still being processed
	select {
	case <-runDone:
		t.Fatal("Run returned before in-flight item completed")
	case <-time.After(200 * time.Millisecond):
		// Expected: still waiting for drain
	}

	// Complete the in-flight item
	close(processCh)

	// Now Run should return
	select {
	case <-runDone:
		assert.True(t, processed.Load(), "item should have been fully processed")
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return after in-flight item completed")
	}
}

func TestRunner_Run_DrainTimeoutForcesShutdown(t *testing.T) {
	processingStarted := make(chan struct{})

	// process blocks forever to simulate a stuck reconciliation
	r := newTestRunner(200*time.Millisecond, func(_ context.Context, _ string) error {
		close(processingStarted)
		select {}
	})

	r.Enqueue("test/stuck")

	ctx, cancel := context.WithCancel(t.Context())
	runDone := make(chan struct{})
	go func() {
		r.Run(ctx, 1, func() {}, func() {})
		close(runDone)
	}()

	// Wait until the worker has actually picked up the item
	<-processingStarted
	cancel()

	// Run should return within the drain timeout + some buffer
	select {
	case <-runDone:
		// Expected: drain timeout kicked in
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return after drain timeout")
	}
}

func TestRunner_Run_OnShutdownCalledBeforeDrain(t *testing.T) {
	var shutdownCalledAt time.Time
	var runReturnedAt time.Time
	processCh := make(chan struct{})
	processingStarted := make(chan struct{})
	shutdownCalled := make(chan struct{})

	r := newTestRunner(5*time.Second, func(_ context.Context, _ string) error {
		close(processingStarted)
		<-processCh
		return nil
	})

	r.Enqueue("test/ordering")

	ctx, cancel := context.WithCancel(t.Context())
	runDone := make(chan struct{})
	go func() {
		r.Run(ctx, 1, func() {}, func() {
			shutdownCalledAt = time.Now()
			close(shutdownCalled)
		})
		runReturnedAt = time.Now()
		close(runDone)
	}()

	<-processingStarted
	cancel()

	// Wait for onShutdown to be called before releasing the drain
	<-shutdownCalled
	close(processCh)

	select {
	case <-runDone:
		require.False(t, shutdownCalledAt.IsZero(), "onShutdown should have been called")
		require.False(t, runReturnedAt.IsZero(), "Run should have returned")
		assert.True(t, shutdownCalledAt.Before(runReturnedAt),
			"onShutdown should be called before Run returns (drain completes)")
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return")
	}
}

// TestRunner_DeduplicatesEnqueueWhileProcessing verifies that multiple enqueue
// calls for the same key while it is being processed result in exactly one additional
// processing round, not one per enqueue call. This guards against memory and CPU growth
// from status-update feedback loops where every reconciliation triggers a new status
// patch which re-enqueues the same key.
func TestRunner_DeduplicatesEnqueueWhileProcessing(t *testing.T) {
	var processCount atomic.Int32
	firstProcessingStarted := make(chan struct{})
	releaseFirst := make(chan struct{})
	secondProcessingDone := make(chan struct{})

	r := newTestRunner(5*time.Second, func(_ context.Context, _ string) error {
		switch processCount.Add(1) {
		case 1:
			close(firstProcessingStarted)
			<-releaseFirst
		case 2:
			close(secondProcessingDone)
		}
		return nil
	})

	r.Enqueue("test/repo")

	ctx, cancel := context.WithCancel(t.Context())
	runDone := make(chan struct{})
	go func() {
		r.Run(ctx, 1, func() {}, func() {})
		close(runDone)
	}()

	// Wait for the first processing round to start, then enqueue the same key several times.
	<-firstProcessingStarted
	for range 5 {
		r.Enqueue("test/repo")
	}
	close(releaseFirst)

	// Wait for the second round to finish, then shut down. Once Run returns no further
	// calls to process are possible, so the count is final.
	<-secondProcessingDone
	cancel()
	<-runDone
	assert.Equal(t, int32(2), processCount.Load(), "5 enqueues while processing must collapse to 1 additional round")
}

// TestRunner_DeduplicatesEnqueueBeforeProcessing verifies that adding the same
// key multiple times before any worker picks it up results in exactly one
// processing round. This is the complement to the while-processing dedup test and
// directly tests the dirty-set no-op path in Add().
func TestRunner_DeduplicatesEnqueueBeforeProcessing(t *testing.T) {
	var processCount atomic.Int32
	processingDone := make(chan struct{})

	r := newTestRunner(5*time.Second, func(_ context.Context, _ string) error {
		processCount.Add(1)
		close(processingDone)
		return nil
	})

	// Enqueue the same key several times before any worker starts.
	for range 5 {
		r.Enqueue("test/repo")
	}

	ctx, cancel := context.WithCancel(t.Context())
	runDone := make(chan struct{})
	go func() {
		r.Run(ctx, 1, func() {}, func() {})
		close(runDone)
	}()

	// Wait for the one expected round, then shut down. Once Run returns the count is final.
	<-processingDone
	cancel()
	<-runDone
	assert.Equal(t, int32(1), processCount.Load(), "5 enqueues before pickup must collapse to 1 processing round")
}

// TestRunner_ServiceUnavailableRetriesUpToMaxAttempts verifies that a
// ServiceUnavailable error causes the key to be re-queued with backoff, and that
// processing stops after the default maximum number of attempts.
func TestRunner_ServiceUnavailableRetriesUpToMaxAttempts(t *testing.T) {
	var processCount atomic.Int32
	allAttemptsDone := make(chan struct{})

	r := newTestRunner(5*time.Second, func(_ context.Context, _ string) error {
		if processCount.Add(1) == defaultMaxAttempts {
			close(allAttemptsDone)
		}
		return apierrors.NewServiceUnavailable("test")
	})

	r.Enqueue("test/repo")

	ctx, cancel := context.WithCancel(t.Context())
	runDone := make(chan struct{})
	go func() {
		r.Run(ctx, 1, func() {}, func() {})
		close(runDone)
	}()

	// Wait for the final attempt, then shut down. Once Run returns the count is final.
	<-allAttemptsDone
	cancel()
	<-runDone
	assert.Equal(t, int32(defaultMaxAttempts), processCount.Load(), "ServiceUnavailable should retry exactly maxAttempts times then give up")
}

// TestRunner_NonRetryableErrorIsNotRetried verifies that errors other than
// ServiceUnavailable are dropped after a single attempt with no re-queue.
func TestRunner_NonRetryableErrorIsNotRetried(t *testing.T) {
	var processCount atomic.Int32
	processingDone := make(chan struct{})

	r := newTestRunner(5*time.Second, func(_ context.Context, _ string) error {
		processCount.Add(1)
		close(processingDone)
		return errors.New("some non-retryable error")
	})

	r.Enqueue("test/repo")

	ctx, cancel := context.WithCancel(t.Context())
	runDone := make(chan struct{})
	go func() {
		r.Run(ctx, 1, func() {}, func() {})
		close(runDone)
	}()

	// Wait for the one expected attempt, then shut down. Once Run returns the count is final.
	<-processingDone
	cancel()
	<-runDone
	assert.Equal(t, int32(1), processCount.Load(), "non-retryable errors must not be retried")
}

// TestRunner_CustomRetriable verifies that a configured Retriable classifier
// replaces the default ServiceUnavailable check.
func TestRunner_CustomRetriable(t *testing.T) {
	retriableErr := errors.New("transient")
	var processCount atomic.Int32
	allAttemptsDone := make(chan struct{})

	r := NewRunner(RunnerConfig{
		Name:         "test-runner",
		DrainTimeout: 5 * time.Second,
		MaxAttempts:  2,
		Retriable:    func(err error) bool { return errors.Is(err, retriableErr) },
		Process: func(_ context.Context, _ string) error {
			if processCount.Add(1) == 2 {
				close(allAttemptsDone)
			}
			return retriableErr
		},
	})

	r.Enqueue("test/repo")

	ctx, cancel := context.WithCancel(t.Context())
	runDone := make(chan struct{})
	go func() {
		r.Run(ctx, 1, func() {}, func() {})
		close(runDone)
	}()

	<-allAttemptsDone
	cancel()
	<-runDone
	assert.Equal(t, int32(2), processCount.Load(), "custom retriable errors should retry up to MaxAttempts")
}
