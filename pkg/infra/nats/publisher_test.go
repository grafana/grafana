package nats

import (
	"context"
	"testing"

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
