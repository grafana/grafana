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
	processingStarted := make(chan struct{})
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
		close(processingStarted)
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

func TestRepositoryController_Run_DrainTimeoutForcesShutdown(t *testing.T) {
	processingStarted := make(chan struct{})

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
		close(processingStarted)
		select {}
	}

	rc.queue.Add(&queueItem{key: "test/stuck"})

	ctx, cancel := context.WithCancel(context.Background())
	runDone := make(chan struct{})
	go func() {
		rc.Run(ctx, 1, func() {}, func() {})
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

func TestRepositoryController_Run_OnShutdownCalledBeforeDrain(t *testing.T) {
	var shutdownCalledAt time.Time
	var runReturnedAt time.Time
	processCh := make(chan struct{})
	processingStarted := make(chan struct{})
	shutdownCalled := make(chan struct{})

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
		close(processingStarted)
		<-processCh
		return nil
	}

	rc.queue.Add(&queueItem{key: "test/ordering"})

	ctx, cancel := context.WithCancel(context.Background())
	runDone := make(chan struct{})
	go func() {
		rc.Run(ctx, 1, func() {}, func() {
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

func TestConnectionController_Run_DrainWaitsForInFlight(t *testing.T) {
	processCh := make(chan struct{})
	processingStarted := make(chan struct{})
	var processed atomic.Bool

	cc := &ConnectionController{
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[*connectionQueueItem](),
			workqueue.TypedRateLimitingQueueConfig[*connectionQueueItem]{
				Name: "test-connection-drain",
			},
		),
		connSynced:   func() bool { return true },
		logger:       logging.DefaultLogger.With("logger", "test"),
		drainTimeout: 5 * time.Second,
	}

	cc.processFn = func(ctx context.Context, item *connectionQueueItem) error {
		close(processingStarted)
		<-processCh
		processed.Store(true)
		return nil
	}

	cc.queue.Add(&connectionQueueItem{key: "test/conn"})

	ctx, cancel := context.WithCancel(context.Background())
	runDone := make(chan struct{})
	go func() {
		cc.Run(ctx, 1, func() {}, func() {})
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

func TestConnectionController_Run_DrainTimeoutForcesShutdown(t *testing.T) {
	processingStarted := make(chan struct{})

	cc := &ConnectionController{
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[*connectionQueueItem](),
			workqueue.TypedRateLimitingQueueConfig[*connectionQueueItem]{
				Name: "test-connection-drain-timeout",
			},
		),
		connSynced:   func() bool { return true },
		logger:       logging.DefaultLogger.With("logger", "test"),
		drainTimeout: 200 * time.Millisecond,
	}

	// processFn blocks forever to simulate a stuck reconciliation
	cc.processFn = func(ctx context.Context, item *connectionQueueItem) error {
		close(processingStarted)
		select {}
	}

	cc.queue.Add(&connectionQueueItem{key: "test/stuck"})

	ctx, cancel := context.WithCancel(context.Background())
	runDone := make(chan struct{})
	go func() {
		cc.Run(ctx, 1, func() {}, func() {})
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

func TestConnectionController_Run_OnShutdownCalledBeforeDrain(t *testing.T) {
	var shutdownCalledAt time.Time
	var runReturnedAt time.Time
	processCh := make(chan struct{})
	processingStarted := make(chan struct{})
	shutdownCalled := make(chan struct{})

	cc := &ConnectionController{
		queue: workqueue.NewTypedRateLimitingQueueWithConfig(
			workqueue.DefaultTypedControllerRateLimiter[*connectionQueueItem](),
			workqueue.TypedRateLimitingQueueConfig[*connectionQueueItem]{
				Name: "test-connection-shutdown-ordering",
			},
		),
		connSynced:   func() bool { return true },
		logger:       logging.DefaultLogger.With("logger", "test"),
		drainTimeout: 5 * time.Second,
	}

	cc.processFn = func(ctx context.Context, item *connectionQueueItem) error {
		close(processingStarted)
		<-processCh
		return nil
	}

	cc.queue.Add(&connectionQueueItem{key: "test/ordering"})

	ctx, cancel := context.WithCancel(context.Background())
	runDone := make(chan struct{})
	go func() {
		cc.Run(ctx, 1, func() {}, func() {
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
