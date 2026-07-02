package nats

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSubscriber(t *testing.T) {
	t.Run("is disabled when NATS is off", func(t *testing.T) {
		cfg := setting.NATSSettings{Enabled: false}
		s := newSubscriber(log.NewNopLogger(), newSubscriberMetrics(), newConfig(cfg, nil))

		require.False(t, s.Enabled())
		require.True(t, s.IsDisabled())

		_, err := s.Subscribe(context.Background(), "subj", func(string, []byte) {})
		require.ErrorIs(t, err, ErrDisabled)
	})

	t.Run("delivers a published message to the handler", func(t *testing.T) {
		srv := startTestServer(t)
		pub := newTestPublisher(t, srv)
		sub := newTestSubscriber(t, srv)

		received := make(chan []byte, 1)
		_, err := sub.Subscribe(context.Background(), "grafana.test.a", func(_ string, data []byte) {
			received <- data
		})
		require.NoError(t, err)

		// The SUB protocol is processed asynchronously by the server, so retry the
		// publish until the subscription is active and the message lands.
		require.Eventually(t, func() bool {
			require.NoError(t, pub.Publish(context.Background(), "grafana.test.a", []byte("hello")))
			select {
			case got := <-received:
				require.Equal(t, []byte("hello"), got)
				return true
			case <-time.After(20 * time.Millisecond):
				return false
			}
		}, 5*time.Second, time.Millisecond)
	})

	t.Run("queue subscribe delivers a published message", func(t *testing.T) {
		srv := startTestServer(t)
		pub := newTestPublisher(t, srv)
		sub := newTestSubscriber(t, srv)

		received := make(chan []byte, 1)
		_, err := sub.Subscribe(context.Background(), "grafana.test.q", func(_ string, data []byte) {
			received <- data
		}, WithQueueGroup("workers"))
		require.NoError(t, err)

		require.Eventually(t, func() bool {
			require.NoError(t, pub.Publish(context.Background(), "grafana.test.q", []byte("hello")))
			select {
			case got := <-received:
				require.Equal(t, []byte("hello"), got)
				return true
			case <-time.After(20 * time.Millisecond):
				return false
			}
		}, 5*time.Second, time.Millisecond)
	})

	t.Run("unsubscribe stops delivery", func(t *testing.T) {
		srv := startTestServer(t)
		pub := newTestPublisher(t, srv)
		sub := newTestSubscriber(t, srv)

		var count atomic.Int64
		subscription, err := sub.Subscribe(context.Background(), "grafana.test.u", func(string, []byte) {
			count.Add(1)
		})
		require.NoError(t, err)
		require.NoError(t, subscription.Unsubscribe())

		// After unsubscribe the broker drops interest; nothing should be delivered.
		require.NoError(t, pub.Publish(context.Background(), "grafana.test.u", []byte("hello")))
		require.Never(t, func() bool { return count.Load() > 0 }, 200*time.Millisecond, 20*time.Millisecond)
	})

	t.Run("subscribe after close returns ErrClosed", func(t *testing.T) {
		sub := newTestSubscriber(t, startTestServer(t))
		sub.close()

		_, err := sub.Subscribe(context.Background(), "grafana.test.a", func(string, []byte) {})
		require.ErrorIs(t, err, ErrClosed)
	})

	t.Run("records handler duration on delivery", func(t *testing.T) {
		srv := startTestServer(t)
		m := newSubscriberMetrics()
		cfg := setting.NATSSettings{Enabled: true}
		sub := newSubscriber(log.NewNopLogger(), m, newTestConfig(srv, cfg))
		t.Cleanup(sub.close)
		pub := newTestPublisher(t, srv)

		received := make(chan struct{}, 1)
		_, err := sub.Subscribe(context.Background(), "grafana.test.dur", func(string, []byte) {
			received <- struct{}{}
		})
		require.NoError(t, err)

		require.Eventually(t, func() bool {
			require.NoError(t, pub.Publish(context.Background(), "grafana.test.dur", []byte("x")))
			select {
			case <-received:
				return true
			case <-time.After(20 * time.Millisecond):
				return false
			}
		}, 5*time.Second, time.Millisecond)

		// The handler observation happens just after the handler returns; give it a
		// beat to land before reading the histogram.
		require.Eventually(t, func() bool {
			return histogramSampleCount(t, m.handlerDuration) >= 1
		}, time.Second, 5*time.Millisecond)
	})

	t.Run("counts slow-consumer async errors", func(t *testing.T) {
		m := newSubscriberMetrics()
		cfg := setting.NATSSettings{Enabled: true}
		sub := newSubscriber(log.NewNopLogger(), m, newConfig(cfg, nil))

		// Drive the connection's async error hook directly: slow-consumer errors are
		// counted, unrelated async errors are ignored.
		sub.onAsyncError(natsclient.ErrSlowConsumer)
		sub.onAsyncError(context.Canceled)

		require.Equal(t, float64(1), testutil.ToFloat64(m.slowConsumers))
	})

	t.Run("subscribe honours a cancelled context", func(t *testing.T) {
		sub := newTestSubscriber(t, startTestServer(t))

		// Warm the connection so get() succeeds and the cancellation is observed by
		// the explicit ctx.Err() check rather than during connect.
		_, err := sub.Subscribe(context.Background(), "grafana.test.a", func(string, []byte) {})
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		_, err = sub.Subscribe(ctx, "grafana.test.b", func(string, []byte) {})
		require.ErrorIs(t, err, context.Canceled)
	})

	t.Run("WithOnReconnect records the callback on the config", func(t *testing.T) {
		var called atomic.Bool
		var cfg subscribeConfig
		WithOnReconnect(func() { called.Store(true) })(&cfg)

		require.NotNil(t, cfg.onReconnect, "WithOnReconnect must set the callback")
		cfg.onReconnect()
		require.True(t, called.Load(), "the stored callback must be the one passed in")
	})

	t.Run("Subscribe without WithOnReconnect registers no callback", func(t *testing.T) {
		sub := newTestSubscriber(t, startTestServer(t))

		_, err := sub.Subscribe(context.Background(), "grafana.test.plain", func(string, []byte) {})
		require.NoError(t, err)

		sub.mu.Lock()
		require.Empty(t, sub.reconnectCbs, "no reconnect callback must be registered without the option")
		sub.mu.Unlock()
	})

	// The callback is a per-subscription option, not a single subscriber-wide
	// setting: each subscription's callback fires on reconnect, and unsubscribing
	// one leaves the others untouched.
	t.Run("each subscription gets its own reconnect callback", func(t *testing.T) {
		sub := newTestSubscriber(t, startTestServer(t))

		var a, b atomic.Int64
		sa, err := sub.Subscribe(context.Background(), "grafana.test.a", func(string, []byte) {},
			WithOnReconnect(func() { a.Add(1) }))
		require.NoError(t, err)
		_, err = sub.Subscribe(context.Background(), "grafana.test.b", func(string, []byte) {},
			WithOnReconnect(func() { b.Add(1) }))
		require.NoError(t, err)

		sub.fireReconnect()
		require.EqualValues(t, 1, a.Load())
		require.EqualValues(t, 1, b.Load())

		// Unsubscribing one drops only its callback; the other keeps firing.
		require.NoError(t, sa.Unsubscribe())
		sub.fireReconnect()
		require.EqualValues(t, 1, a.Load(), "unsubscribed subscription must not fire again")
		require.EqualValues(t, 2, b.Load(), "other subscription must keep firing")
	})
}
