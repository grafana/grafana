package resource

import (
	"context"
	"io"
	"testing"
	"testing/synctest"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

func TestGenericSubscriptionContextOnlyAppliesToSubmission(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		release := make(chan struct{})
		input := make(chan int)
		b := newBroadcasterWithSizes(t.Context(), input, watchChanSize, defaultOverflowCap, newBroadcasterMetrics(prometheus.NewRegistry()), nil, nil,
			func(ctx context.Context) (cacheSeed[int], error) {
				select {
				case <-ctx.Done():
					return cacheSeed[int]{}, ctx.Err()
				case <-release:
					return cacheSeed[int]{items: []int{1}}, nil
				}
			})

		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		stream, err := b.Subscribe(ctx, "generic", "r")
		require.NoError(t, err)
		cancel()
		synctest.Wait()
		require.Empty(t, stream)
		close(release)

		require.Equal(t, 1, <-stream)
		input <- 2
		require.Equal(t, 2, <-stream)
		b.Unsubscribe(stream)
	})
}

func TestSubscriptionReplayFailureContracts(t *testing.T) {
	for _, checked := range []bool{false, true} {
		t.Run(map[bool]string{false: "generic", true: "checked"}[checked], func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				metrics := newBroadcasterMetrics(prometheus.NewRegistry())
				b := newBroadcasterWithSizes(t.Context(), make(chan int), 1, defaultOverflowCap, metrics, nil, nil,
					func(context.Context) (cacheSeed[int], error) {
						return cacheSeed[int]{items: []int{1, 2}}, nil
					})

				if checked {
					stream, err := b.subscribeWatch(t.Context(), "checked", "r", nil)
					require.ErrorIs(t, err, io.ErrShortBuffer)
					require.Nil(t, stream)
				} else {
					stream, err := b.Subscribe(t.Context(), "generic", "r")
					require.NoError(t, err)
					synctest.Wait()
					require.Equal(t, 1, <-stream)
					_, open := <-stream
					require.False(t, open)
				}
				synctest.Wait()
				requireMetricValue(t, metrics.SubscriptionsTotal.WithLabelValues("r", subscriptionResultReplayFailed), 1)
				require.Empty(t, b.subs)
			})
		})
	}
}
