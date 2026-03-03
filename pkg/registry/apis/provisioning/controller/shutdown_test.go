package controller

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/util/workqueue"
)

func TestRepositoryController_Run_DrainWaitsForInFlight(t *testing.T) {
	processCh := make(chan struct{})
	var processed atomic.Bool

	rc := &RepositoryController{
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[*queueItem](),
			workqueue.TypedRateLimitingQueueConfig[*queueItem]{
				Name: "test-drain",
			},
		),
		repoSynced:   func() bool { return true },
		logger:       logging.DefaultLogger.With("logger", "test"),
		drainTimeout: 5 * time.Second,
	}

	rc.processFn = func(item *queueItem) error {
		<-processCh
		processed.Store(true)
		return nil
	}

	rc.queue.Add(&queueItem{key: "test/repo"})

	ctx, cancel := context.WithCancel(context.Background())
	runDone := make(chan struct{})
	go func() {
		rc.Run(ctx, 1, func() {}, func() {})
		close(runDone)
	}()

	// Give the worker time to pick up the item
	time.Sleep(100 * time.Millisecond)

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

func TestRepositoryController_Run_DrainTimeoutForcesShutdown(t *testing.T) {
	rc := &RepositoryController{
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[*queueItem](),
			workqueue.TypedRateLimitingQueueConfig[*queueItem]{
				Name: "test-drain-timeout",
			},
		),
		repoSynced:   func() bool { return true },
		logger:       logging.DefaultLogger.With("logger", "test"),
		drainTimeout: 200 * time.Millisecond,
	}

	// processFn blocks forever to simulate a stuck reconciliation
	rc.processFn = func(item *queueItem) error {
		select {}
	}

	rc.queue.Add(&queueItem{key: "test/stuck"})

	ctx, cancel := context.WithCancel(context.Background())
	runDone := make(chan struct{})
	go func() {
		rc.Run(ctx, 1, func() {}, func() {})
		close(runDone)
	}()

	// Give the worker time to pick up the item
	time.Sleep(100 * time.Millisecond)
	cancel()

	// Run should return within the drain timeout + some buffer
	select {
	case <-runDone:
		// Expected: drain timeout kicked in
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return after drain timeout")
	}
}

func TestRepositoryController_Run_OnShutdownCalledBeforeDrain(t *testing.T) {
	var shutdownCalledAt time.Time
	var runReturnedAt time.Time
	processCh := make(chan struct{})

	rc := &RepositoryController{
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[*queueItem](),
			workqueue.TypedRateLimitingQueueConfig[*queueItem]{
				Name: "test-shutdown-ordering",
			},
		),
		repoSynced:   func() bool { return true },
		logger:       logging.DefaultLogger.With("logger", "test"),
		drainTimeout: 5 * time.Second,
	}

	rc.processFn = func(item *queueItem) error {
		<-processCh
		return nil
	}

	rc.queue.Add(&queueItem{key: "test/ordering"})

	ctx, cancel := context.WithCancel(context.Background())
	runDone := make(chan struct{})
	go func() {
		rc.Run(ctx, 1, func() {}, func() {
			shutdownCalledAt = time.Now()
		})
		runReturnedAt = time.Now()
		close(runDone)
	}()

	time.Sleep(100 * time.Millisecond)
	cancel()

	// Let the in-flight item complete after a short delay
	time.Sleep(100 * time.Millisecond)
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
