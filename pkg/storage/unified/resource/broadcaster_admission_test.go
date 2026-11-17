package resource

import (
	"context"
	"io"
	"testing"
	"testing/synctest"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

func TestSubscriptionReplayFailureContract(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		metrics := newBroadcasterMetrics(prometheus.NewRegistry())
		b := newBroadcasterWithSizes(t.Context(), make(chan int), 1, defaultOverflowCap, metrics, intIdentity,
			&seededCacheConfig[int]{initialize: func(context.Context) (cacheSeed[int], error) {
				return cacheSeed[int]{items: []int{1, 2}}, nil
			}})

		stream, _, err := b.subscribeWatch(t.Context(), "checked", intGR, intResume(0))
		require.ErrorIs(t, err, io.ErrShortBuffer)
		require.Nil(t, stream)
		synctest.Wait()
		requireMetricValue(t, metrics.SubscriptionsTotal.WithLabelValues("r", subscriptionResultReplayFailed), 1)
		require.Empty(t, b.subs)
	})
}
