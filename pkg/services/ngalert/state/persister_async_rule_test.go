package state

import (
	"context"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestAsyncRuleStatePersister_Async(t *testing.T) {
	t.Run("should save on tick", func(t *testing.T) {
		mockClock := clock.NewMock()
		store := &FakeInstanceStore{}
		logger := log.New("async.rule.test")

		persister := NewAsyncRuleStatePersister(logger, mockClock, 1*time.Second, ManagerCfg{
			InstanceStore: store,
		})

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		cache := newCache()

		go persister.Async(ctx, cache)

		cache.set(&State{
			OrgID:        1,
			State:        eval.Alerting,
			AlertRuleUID: "1",
		})

		// Wait for the goroutine to start and create the ticker, then advance the clock.
		// The mock clock's ticker won't fire until time is advanced after it's created.
		require.Eventually(t, func() bool {
			mockClock.Add(1 * time.Second)
			return len(store.RecordedOps()) == 1
		}, time.Second*5, 10*time.Millisecond)
	})

	t.Run("should save on context done", func(t *testing.T) {
		mockClock := clock.NewMock()
		store := &FakeInstanceStore{}
		logger := log.New("async.rule.test")

		persister := NewAsyncRuleStatePersister(logger, mockClock, 1*time.Second, ManagerCfg{
			InstanceStore: store,
		})

		ctx, cancel := context.WithCancel(context.Background())

		cache := newCache()

		go persister.Async(ctx, cache)

		cache.set(&State{
			OrgID:        1,
			State:        eval.Alerting,
			AlertRuleUID: "1",
		})

		// Now we cancel the context
		cancel()

		// Check if the context cancellation was handled correctly
		require.Eventually(t, func() bool {
			return len(store.RecordedOps()) == 1
		}, time.Second*5, time.Second)
	})
}

func TestAsyncRuleStatePersister_Async_StopsOnContextCancel(t *testing.T) {
	mockClock := clock.NewMock()
	store := &FakeInstanceStore{}
	logger := log.New("async.rule.test")

	persister := NewAsyncRuleStatePersister(logger, mockClock, 1*time.Second, ManagerCfg{
		InstanceStore: store,
	})

	ctx, cancel := context.WithCancel(context.Background())
	cache := newCache()

	done := make(chan struct{})
	go func() {
		persister.Async(ctx, cache)
		close(done)
	}()

	// Cancel context to stop the persister
	cancel()

	// Verify the goroutine exits (ticker stopped)
	select {
	case <-done:
		// Success - Async() returned
	case <-time.After(time.Second):
		t.Fatal("Async() did not return after context cancellation")
	}

	// Verify no more operations happen after stopping
	initialOps := len(store.RecordedOps())
	mockClock.Add(5 * time.Second)
	require.Equal(t, initialOps, len(store.RecordedOps()), "no more saves should happen after context cancel")
}

func TestAsyncRuleStatePersister_Sync(t *testing.T) {
	t.Run("sync is a no-op", func(t *testing.T) {
		store := &FakeInstanceStore{}
		logger := log.New("async.rule.test")

		persister := NewAsyncRuleStatePersister(logger, clock.NewMock(), 1*time.Second, ManagerCfg{
			InstanceStore: store,
		})

		persister.Sync(context.Background(), nil, models.AlertRuleKeyWithGroup{}, StateTransitions{
			{State: &State{OrgID: 1, AlertRuleUID: "1"}},
		})

		require.Empty(t, store.RecordedOps(), "Sync should be a no-op for async persister")
	})
}
