package state

import (
	"context"
	"testing"
	"testing/synctest"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestAsyncRuleStatePersister_Async(t *testing.T) {
	t.Run("should save on tick", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			realClock := clock.New()
			store := &FakeInstanceStore{}
			logger := log.New("async.rule.test")

			persister := NewAsyncRuleStatePersister(logger, realClock, 1*time.Second, ManagerCfg{
				InstanceStore: store,
			})

			ctx := t.Context()

			cache := newCache()

			go persister.Async(ctx, cache)

			cache.set(&State{
				OrgID:        1,
				State:        eval.Alerting,
				AlertRuleUID: "1",
			})

			// Let Async create its ticker before advancing to the first persistence tick.
			synctest.Wait()

			require.Empty(t, store.RecordedOps())

			// Complete the first periodic save before inspecting the recorded operation.
			synctest.Sleep(time.Second)

			require.Len(t, store.RecordedOps(), 1)
		})
	})

	t.Run("should save on context done", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			realClock := clock.New()
			store := &FakeInstanceStore{}
			logger := log.New("async.rule.test")

			persister := NewAsyncRuleStatePersister(logger, realClock, 1*time.Second, ManagerCfg{
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

			// Finish the cancellation flush before inspecting persistence.
			synctest.Wait()

			require.Len(t, store.RecordedOps(), 1)
		})
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
