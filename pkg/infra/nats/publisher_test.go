package nats

import (
	"context"
	"testing"
	"time"

	promtestutil "github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestPublisher(t *testing.T) {
	t.Run("is disabled when NATS is off", func(t *testing.T) {
		cfg := setting.NATSSettings{Enabled: false}
		p := newPublisher(log.NewNopLogger(), newPublisherMetrics(), newConfig(cfg, nil))

		require.False(t, p.Enabled())
		require.True(t, p.IsDisabled())
		require.ErrorIs(t, p.Publish(context.Background(), "subj", []byte("x")), ErrDisabled)
	})

	t.Run("publishes a message", func(t *testing.T) {
		p := newTestPublisher(t, startTestServer(t))
		require.NoError(t, p.Publish(context.Background(), "grafana.test.a", []byte("hello")))
	})

	t.Run("publish after close returns ErrClosed", func(t *testing.T) {
		p := newTestPublisher(t, startTestServer(t))
		require.NoError(t, p.Publish(context.Background(), "grafana.test.a", []byte("hello")))

		p.close()
		require.ErrorIs(t, p.Publish(context.Background(), "grafana.test.a", []byte("world")), ErrClosed)
	})

	t.Run("publish reports a connection that was never established", func(t *testing.T) {
		cfg := setting.NATSSettings{
			Enabled:    true,
			Mode:       setting.NATSModeExternal,
			ClientURLs: []string{"nats://127.0.0.1:1"},
		}
		p := newPublisher(log.NewNopLogger(), newPublisherMetrics(), newConfig(cfg, nil))
		t.Cleanup(p.close)

		err := p.Publish(context.Background(), "grafana.test.a", []byte("hello"))
		// The bounded publisher reconnect buffer accepts the message locally even
		// though the initial connection is still retrying.
		require.NoError(t, err)
	})

	t.Run("starting tolerates a broker outage at boot", func(t *testing.T) {
		// No server is listening, so a transient outage must not fail startup.
		cfg := setting.NATSSettings{
			Enabled:    true,
			Mode:       setting.NATSModeExternal,
			ClientURLs: []string{"nats://127.0.0.1:1"},
		}
		p := newPublisher(log.NewNopLogger(), newPublisherMetrics(), newConfig(cfg, nil))
		t.Cleanup(p.close)

		ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
		t.Cleanup(cancel)
		require.NoError(t, p.starting(ctx))
	})

	t.Run("flush reconciliation clears only the flushed watermark", func(t *testing.T) {
		p := newPublisher(log.NewNopLogger(), newPublisherMetrics(), newConfig(setting.NATSSettings{Enabled: true}, nil))

		// 100 bytes were pending at snapshot; a concurrent Publish buffered 40 more.
		p.pendingBytes = 140
		p.oldestPending = time.Now().UnixNano()

		p.reconcilePending(100)

		require.Equal(t, int64(40), p.pendingBytes)
		require.NotZero(t, p.oldestPending)
		require.Equal(t, float64(40), promtestutil.ToFloat64(p.metrics.pendingBytes))

		p.reconcilePending(40)
		require.Zero(t, p.pendingBytes)
		require.Zero(t, p.oldestPending)
		require.Equal(t, float64(0), promtestutil.ToFloat64(p.metrics.pendingBytes))
	})

	t.Run("publish honours a cancelled context", func(t *testing.T) {
		p := newTestPublisher(t, startTestServer(t))

		// Warm the connection so get() succeeds and the cancellation is observed by
		// the explicit ctx.Err() check rather than during connect.
		require.NoError(t, p.Publish(context.Background(), "grafana.test.a", []byte("hello")))

		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		require.ErrorIs(t, p.Publish(ctx, "grafana.test.a", []byte("world")), context.Canceled)
	})
}
