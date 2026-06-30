package nats

import (
	"context"
	"sync"
	"testing"
	"time"

	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// newDisabledConnection builds a connection with NATS turned off, for the paths
// that must short-circuit before any dial.
func newDisabledConnection() *connection {
	cfg := setting.NATSSettings{Enabled: false}
	return newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() string { return "" })
}

func TestConnection(t *testing.T) {
	t.Run("Enabled reflects config", func(t *testing.T) {
		require.False(t, newDisabledConnection().Enabled())

		cfg := setting.NATSSettings{Enabled: true}
		enabled := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() string { return "" })
		require.True(t, enabled.Enabled())
	})

	t.Run("get returns ErrDisabled when disabled", func(t *testing.T) {
		_, err := newDisabledConnection().get(context.Background())
		require.ErrorIs(t, err, ErrDisabled)
	})

	t.Run("get errors when no urls configured", func(t *testing.T) {
		cfg := setting.NATSSettings{Enabled: true}
		c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() string { return "" })

		_, err := c.get(context.Background())
		require.ErrorContains(t, err, "no nats client urls configured")
	})

	t.Run("get reuses the established connection", func(t *testing.T) {
		c := newTestConnection(t, startTestServer(t))

		first, err := c.get(context.Background())
		require.NoError(t, err)
		require.NotNil(t, first)

		second, err := c.get(context.Background())
		require.NoError(t, err)
		// The warm path returns the same connection rather than redialing.
		require.Same(t, first, second)
	})

	t.Run("get sets the connection status metric", func(t *testing.T) {
		srv := startTestServer(t)
		cfg := setting.NATSSettings{Enabled: true}
		m := newConnectionMetrics(rolePublisher)
		c := newConnection(rolePublisher, log.NewNopLogger(), m, newTestConfig(srv, cfg), func() string { return "" })
		t.Cleanup(c.close)

		_, err := c.get(context.Background())
		require.NoError(t, err)

		// The ConnectHandler fires asynchronously; wait for it to mark the role healthy.
		require.Eventually(t, func() bool {
			return testutil.ToFloat64(m.connectionStatus) == 1
		}, 5*time.Second, 10*time.Millisecond)
	})

	t.Run("get honours a cancelled context on the warm path", func(t *testing.T) {
		c := newTestConnection(t, startTestServer(t))

		// Warm the connection so cancellation is observed by the explicit ctx.Err()
		// check rather than during the dial.
		_, err := c.get(context.Background())
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		_, err = c.get(ctx)
		require.ErrorIs(t, err, context.Canceled)
	})

	t.Run("get returns ErrClosed after close", func(t *testing.T) {
		c := newTestConnection(t, startTestServer(t))

		_, err := c.get(context.Background())
		require.NoError(t, err)

		c.close()
		_, err = c.get(context.Background())
		require.ErrorIs(t, err, ErrClosed)
	})

	t.Run("get is safe for concurrent callers", func(t *testing.T) {
		c := newTestConnection(t, startTestServer(t))

		var (
			wg    sync.WaitGroup
			mu    sync.Mutex
			conns = map[*natsclient.Conn]struct{}{}
		)
		for i := 0; i < 50; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				nc, err := c.get(context.Background())
				require.NoError(t, err)
				mu.Lock()
				conns[nc] = struct{}{}
				mu.Unlock()
			}()
		}
		wg.Wait()

		// Concurrent callers must all share the single lazily-established connection.
		require.Len(t, conns, 1)
	})

	t.Run("healthy", func(t *testing.T) {
		t.Run("disabled", func(t *testing.T) {
			require.ErrorIs(t, newDisabledConnection().healthy(), ErrDisabled)
		})

		t.Run("lazy before first use", func(t *testing.T) {
			c := newTestConnection(t, startTestServer(t))
			// An idle service that has never connected is not a failure.
			require.NoError(t, c.healthy())
		})

		t.Run("connected", func(t *testing.T) {
			c := newTestConnection(t, startTestServer(t))
			_, err := c.get(context.Background())
			require.NoError(t, err)
			require.NoError(t, c.healthy())
		})

		t.Run("closed", func(t *testing.T) {
			c := newTestConnection(t, startTestServer(t))
			c.close()
			require.ErrorIs(t, c.healthy(), ErrClosed)
		})
	})

	t.Run("close", func(t *testing.T) {
		t.Run("is idempotent", func(t *testing.T) {
			c := newTestConnection(t, startTestServer(t))
			_, err := c.get(context.Background())
			require.NoError(t, err)

			require.NotPanics(t, func() {
				c.close()
				c.close()
			})
		})

		t.Run("is safe and terminal without a connection", func(t *testing.T) {
			c := newTestConnection(t, startTestServer(t))
			require.NotPanics(t, c.close)
			require.ErrorIs(t, c.healthy(), ErrClosed)
		})
	})

	t.Run("connectOptions", func(t *testing.T) {
		t.Run("builds base options without auth", func(t *testing.T) {
			cfg := setting.NATSSettings{Enabled: true}
			c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() string { return "" })

			opts, err := c.connectOptions()
			require.NoError(t, err)
			require.NotEmpty(t, opts)
		})

		t.Run("propagates invalid TLS config", func(t *testing.T) {
			cfg := setting.NATSSettings{Enabled: true, TLS: setting.NATSTLSSettings{Enabled: true, CACertPath: "/does/not/exist.pem"}}
			c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() string { return "" })

			_, err := c.connectOptions()
			require.Error(t, err)
		})
	})
}
