package jobs

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// --- JobCleanupController shutdown tests ---

// TestJobCleanupController_Run_StopsOnContextCancel verifies that Run returns
// with context.Canceled once the context is cancelled while the controller is
// idle (waiting for the next cleanup tick).
func TestJobCleanupController_Run_StopsOnContextCancel(t *testing.T) {
	store := &MockStore{}
	store.EXPECT().ListExpiredJobs(mock.Anything, mock.Anything, mock.Anything).
		Return(nil, nil).Maybe()

	cc := NewJobCleanupController(store, &MockHistoryWriter{}, 30*time.Second)

	ctx, cancel := context.WithCancel(context.Background())

	runDone := make(chan error, 1)
	go func() {
		runDone <- cc.Run(ctx)
	}()

	// Give it time to complete the initial cleanup and settle into the ticker loop,
	// then cancel and expect a prompt shutdown.
	time.Sleep(100 * time.Millisecond)
	cancel()

	select {
	case err := <-runDone:
		assert.ErrorIs(t, err, context.Canceled)
	case <-time.After(2 * time.Second):
		t.Fatal("JobCleanupController.Run did not stop after context cancellation")
	}
}

// TestJobCleanupController_Run_CompletesInitialCleanupBeforeExiting verifies
// that if the context is cancelled while the initial synchronous cleanup is
// running, Run waits for it to finish before returning.
//
// This mirrors the behavior tested for ConnectionController and RepositoryController
// in controller/shutdown_test.go: in-progress work completes before the shutdown
// is acknowledged.
func TestJobCleanupController_Run_CompletesInitialCleanupBeforeExiting(t *testing.T) {
	cleanupStarted := make(chan struct{})
	cleanupRelease := make(chan struct{})
	var cleanupCompleted atomic.Bool

	store := &MockStore{}
	// First call: block until released to simulate an in-progress cleanup.
	store.EXPECT().ListExpiredJobs(mock.Anything, mock.Anything, mock.Anything).
		RunAndReturn(func(_ context.Context, _ time.Time, _ int) ([]*provisioning.Job, error) {
			close(cleanupStarted)
			<-cleanupRelease
			cleanupCompleted.Store(true)
			return nil, nil
		}).Once()
	// Subsequent calls (ticker) return empty — should not be reached in this test.
	store.EXPECT().ListExpiredJobs(mock.Anything, mock.Anything, mock.Anything).
		Return(nil, nil).Maybe()

	cc := NewJobCleanupController(store, &MockHistoryWriter{}, 30*time.Second)

	ctx, cancel := context.WithCancel(context.Background())

	runDone := make(chan struct{})
	go func() {
		_ = cc.Run(ctx)
		close(runDone)
	}()

	// Wait until the initial cleanup has started.
	<-cleanupStarted

	// Cancel context while initial cleanup is still in-progress.
	cancel()

	// Run should NOT return yet — the initial cleanup is blocking.
	select {
	case <-runDone:
		t.Fatal("Run returned before initial cleanup completed")
	case <-time.After(200 * time.Millisecond):
		// Expected: still waiting.
	}

	// Release the cleanup.
	close(cleanupRelease)

	// Now Run should return promptly.
	select {
	case <-runDone:
		assert.True(t, cleanupCompleted.Load(), "initial cleanup should have run to completion before Run returned")
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return after initial cleanup completed")
	}
}

// --- ConcurrentJobDriver shutdown tests ---

// TestConcurrentJobDriver_Run_StopsOnContextCancel verifies that Run returns
// nil after context cancellation when all drivers are idle (no jobs to claim).
func TestConcurrentJobDriver_Run_StopsOnContextCancel(t *testing.T) {
	store := &MockStore{}
	store.EXPECT().Claim(mock.Anything).Return(nil, nil, ErrNoJobs).Maybe()

	driver, err := NewConcurrentJobDriver(
		2,
		time.Minute, 50*time.Millisecond, 30*time.Second,
		store, &MockRepoGetter{}, &MockHistoryWriter{},
		make(chan struct{}, 1),
		prometheus.NewRegistry(),
		nil,
	)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())

	runDone := make(chan error, 1)
	go func() {
		runDone <- driver.Run(ctx)
	}()

	// Give drivers time to start and settle into their polling loops.
	time.Sleep(100 * time.Millisecond)
	cancel()

	select {
	case err := <-runDone:
		assert.NoError(t, err, "Run should return nil on context cancellation")
	case <-time.After(2 * time.Second):
		t.Fatal("ConcurrentJobDriver.Run did not stop after context cancellation")
	}
}

// TestConcurrentJobDriver_Run_AllDriversExitBeforeRunReturns verifies that
// ConcurrentJobDriver.Run waits for all spawned driver goroutines to finish
// before returning — i.e., the internal sync.WaitGroup is drained correctly.
//
// This is the key property that makes the WaitGroup drain in RunJobController
// meaningful: the jobs operator's wg.Wait() can only resolve once all drivers
// have fully stopped.
func TestConcurrentJobDriver_Run_AllDriversExitBeforeRunReturns(t *testing.T) {
	const numDrivers = 3

	// claimActive tracks how many driver goroutines are currently inside Claim.
	var claimActive atomic.Int32

	store := &MockStore{}
	// Claim blocks until ctx is cancelled, simulating drivers that are
	// mid-poll when the shutdown signal arrives.
	store.EXPECT().Claim(mock.Anything).
		RunAndReturn(func(ctx context.Context) (*provisioning.Job, func(), error) {
			claimActive.Add(1)
			defer claimActive.Add(-1)
			<-ctx.Done()
			return nil, nil, ctx.Err()
		}).Maybe()

	driver, err := NewConcurrentJobDriver(
		numDrivers,
		time.Minute, 10*time.Millisecond, 30*time.Second,
		store, &MockRepoGetter{}, &MockHistoryWriter{},
		make(chan struct{}, 1),
		prometheus.NewRegistry(),
		nil,
	)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())

	runDone := make(chan error, 1)
	go func() {
		runDone <- driver.Run(ctx)
	}()

	// Wait until all drivers are blocked inside Claim, confirming they have
	// all started and picked up work before we trigger shutdown.
	require.Eventually(t, func() bool {
		return claimActive.Load() >= int32(numDrivers)
	}, 2*time.Second, 10*time.Millisecond, "all %d drivers should be blocked in Claim", numDrivers)

	cancel()

	// Run should return only after ALL driver goroutines have exited.
	select {
	case err := <-runDone:
		assert.NoError(t, err)
		// All Claim calls should have returned by now (drivers fully exited).
		assert.Equal(t, int32(0), claimActive.Load(),
			"all driver goroutines should have exited before Run returned")
	case <-time.After(2 * time.Second):
		t.Fatal("ConcurrentJobDriver.Run did not return after context cancellation; internal WaitGroup may be broken")
	}
}
