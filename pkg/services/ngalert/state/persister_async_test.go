package state

import (
	"bytes"
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
)

func TestAsyncStatePersister_Async(t *testing.T) {
	t.Run("It should save on tick", func(t *testing.T) {
		mockClock := clock.NewMock()
		store := &FakeInstanceStore{}
		reg := prometheus.NewPedanticRegistry()
		stateMetrics := metrics.NewStateMetrics(reg)
		logger := log.New("async.test")

		persister := NewAsyncStatePersister(logger, mockClock.Ticker(1*time.Second), ManagerCfg{
			InstanceStore: store,
			Metrics:       stateMetrics,
		})

		ctx, cancel := context.WithCancel(context.Background())

		defer func() {
			cancel()
		}()

		cache := newCache()

		go persister.Async(ctx, cache)

		cache.set(&State{
			OrgID:        1,
			State:        eval.Alerting,
			AlertRuleUID: "1",
		})
		// Let one tick pass
		mockClock.Add(1 * time.Second)

		// Check if the state was saved
		require.Eventually(t, func() bool {
			return len(store.RecordedOps()) == 1
		}, time.Second*5, time.Second)

		expectedMetric := fmt.Sprintf(
			`# HELP grafana_alerting_state_full_sync_last_time Timestamp of the last full sync in seconds.
			 # TYPE grafana_alerting_state_full_sync_last_time gauge
			 grafana_alerting_state_full_sync_last_time %[1]d
			`,
			mockClock.Now().Unix(),
		)
		err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric), "grafana_alerting_state_full_sync_last_time")
		require.NoError(t, err)
	})

	t.Run("It should save on context done", func(t *testing.T) {
		mockClock := clock.NewMock()
		store := &FakeInstanceStore{}
		logger := log.New("async.test")

		persister := NewAsyncStatePersister(logger, mockClock.Ticker(1*time.Second), ManagerCfg{
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
