package state

import (
	"context"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
)

func TestAsyncStatePersister_Async(t *testing.T) {
	t.Run("It should save on tick", func(t *testing.T) {
		mockClock := clock.NewMock()
		store := &FakeInstanceStore{}
		logger := log.New("async.test")

		persister := NewAsyncStatePersister(logger, ManagerCfg{
			InstanceStore: store,
		})

		ctx, cancel := context.WithCancel(context.Background())

		defer func() {
			cancel()
		}()

		ticker := mockClock.Ticker(1 * time.Second)

		cache := newCache()

		go persister.Async(ctx, ticker, cache)

		cache.set(&State{
			OrgID:        1,
			State:        eval.Alerting,
			AlertRuleUID: "1",
		})
		// Let one tick pass
		mockClock.Add(1 * time.Second)

		// Check if the state was saved
		require.Eventually(t, func() bool {
			return len(store.RecordedOps) == 1
		}, time.Second*5, time.Second)
	})
	t.Run("It should save on context done", func(t *testing.T) {
		mockClock := clock.NewMock()
		store := &FakeInstanceStore{}
		logger := log.New("async.test")

		persister := NewAsyncStatePersister(logger, ManagerCfg{
			InstanceStore: store,
		})

		ctx, cancel := context.WithCancel(context.Background())

		ticker := mockClock.Ticker(1 * time.Second)

		cache := newCache()

		go persister.Async(ctx, ticker, cache)

		cache.set(&State{
			OrgID:        1,
			State:        eval.Alerting,
			AlertRuleUID: "1",
		})

		// Now we cancel the context
		cancel()

		// Check if the context cancellation was handled correctly
		require.Eventually(t, func() bool {
			return len(store.RecordedOps) == 1
		}, time.Second*5, time.Second)
	})
}
