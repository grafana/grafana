package nats

import (
	"context"
	"testing"
	"time"

	natsclient "github.com/nats-io/nats.go"
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

	t.Run("publish returns ErrClosed while shutdown is draining", func(t *testing.T) {
		p := newTestPublisher(t, startTestServer(t))
		nc, err := p.get(context.Background())
		require.NoError(t, err)

		entered := make(chan struct{})
		release := make(chan struct{})
		_, err = nc.Subscribe("hold.drain", func(_ *natsclient.Msg) {
			close(entered)
			<-release
		})
		require.NoError(t, err)
		// Hold a subscription callback open so Drain cannot complete, keeping the
		// connection in the draining state while we probe Publish.
		require.NoError(t, nc.Publish("hold.drain", nil))
		require.NoError(t, nc.Flush())
		select {
		case <-entered:
		case <-time.After(time.Second):
			t.Fatal("subscription callback did not start")
		}

		stopped := make(chan error, 1)
		go func() { stopped <- p.stopping(nil) }()
		require.Eventually(t, nc.IsDraining, time.Second, time.Millisecond)

		// Publish must fail fast with ErrClosed rather than block on the drain.
		published := make(chan error, 1)
		go func() { published <- p.Publish(context.Background(), "test", nil) }()
		select {
		case err := <-published:
			require.ErrorIs(t, err, ErrClosed)
		case <-time.After(time.Second):
			t.Fatal("Publish blocked behind shutdown drain")
		}
		// Confirm the drain was still in progress, i.e. we probed the racing window.
		select {
		case <-stopped:
			t.Fatal("drain completed before the subscription was released")
		default:
		}

		close(release)
		select {
		case err := <-stopped:
			require.NoError(t, err)
		case <-time.After(5 * time.Second):
			t.Fatal("shutdown did not finish after releasing the drain")
		}
	})

	t.Run("publish reports a connection that was never established", func(t *testing.T) {
		cfg := setting.NATSSettings{
			Enabled:    true,
			Mode:       setting.NATSModeExternal,
			ClientURLs: []string{"nats://127.0.0.1:1"},
		}
		p := newPublisher(log.NewNopLogger(), newPublisherMetrics(), newConfig(cfg, nil))
		t.Cleanup(p.close)
		require.NoError(t, p.starting(context.Background()))

		err := p.Publish(context.Background(), "grafana.test.a", []byte("hello"))
		require.ErrorIs(t, err, natsclient.ErrConnectionReconnecting)
		require.Zero(t, promtestutil.ToFloat64(p.metrics.messagesAccepted))
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

	t.Run("publish honours a cancelled context", func(t *testing.T) {
		p := newTestPublisher(t, startTestServer(t))

		require.NoError(t, p.Publish(context.Background(), "grafana.test.a", []byte("hello")))

		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		require.ErrorIs(t, p.Publish(ctx, "grafana.test.a", []byte("world")), context.Canceled)
	})
}
