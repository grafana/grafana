package nats

import (
	"context"
	"sync"
	"sync/atomic"
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
	return newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() roleAuth { return roleAuth{} })
}

func TestConnection(t *testing.T) {
	t.Run("Enabled reflects config", func(t *testing.T) {
		require.False(t, newDisabledConnection().Enabled())

		cfg := setting.NATSSettings{Enabled: true}
		enabled := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() roleAuth { return roleAuth{} })
		require.True(t, enabled.Enabled())
	})

	t.Run("get returns ErrDisabled when disabled", func(t *testing.T) {
		_, err := newDisabledConnection().get(context.Background())
		require.ErrorIs(t, err, ErrDisabled)
	})

	t.Run("get errors when no urls configured", func(t *testing.T) {
		cfg := setting.NATSSettings{Enabled: true}
		c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() roleAuth { return roleAuth{} })

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
		c := newConnection(rolePublisher, log.NewNopLogger(), m, newTestConfig(srv, cfg), func() roleAuth { return roleAuth{} })
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
			c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() roleAuth { return roleAuth{} })

			opts, err := c.connectOptions()
			require.NoError(t, err)
			require.NotEmpty(t, opts)
		})

		t.Run("propagates invalid TLS config", func(t *testing.T) {
			cfg := setting.NATSSettings{Enabled: true, TLS: setting.NATSTLSSettings{Enabled: true, CACertPath: "/does/not/exist.pem"}}
			c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() roleAuth { return roleAuth{} })

			_, err := c.connectOptions()
			require.Error(t, err)
		})

		resolveOptions := func(t *testing.T, auth roleAuth, token string) natsclient.Options {
			t.Helper()
			cfg := setting.NATSSettings{Enabled: true, Auth: setting.NATSAuthSettings{Token: token}}
			c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() roleAuth { return auth })
			opts, err := c.connectOptions()
			require.NoError(t, err)
			var resolved natsclient.Options
			for _, opt := range opts {
				require.NoError(t, opt(&resolved))
			}
			return resolved
		}

		t.Run("uses username/password when no creds file is set", func(t *testing.T) {
			resolved := resolveOptions(t, roleAuth{username: "pub", password: "pubpw"}, "tok")
			require.Equal(t, "pub", resolved.User)
			require.Equal(t, "pubpw", resolved.Password)
			require.Empty(t, resolved.Token)
		})

		t.Run("credentials file outranks username/password", func(t *testing.T) {
			// An unreadable creds file only errors if the creds branch was chosen
			// over user/password: UserCredentials reads the file, UserInfo doesn't.
			cfg := setting.NATSSettings{Enabled: true}
			auth := roleAuth{credentialsFile: "/does/not/exist.creds", username: "pub", password: "pubpw"}
			c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() roleAuth { return auth })
			opts, err := c.connectOptions()
			require.NoError(t, err)
			var applyErr error
			for _, opt := range opts {
				if err := opt(&natsclient.Options{}); err != nil {
					applyErr = err
				}
			}
			require.ErrorContains(t, applyErr, "/does/not/exist.creds")
		})

		t.Run("falls back to token when no per-role identity is set", func(t *testing.T) {
			resolved := resolveOptions(t, roleAuth{}, "tok")
			require.Equal(t, "tok", resolved.Token)
			require.Empty(t, resolved.User)
		})
	})

	// The reconnect registry is pure bookkeeping — it never dials — so a disabled
	// connection is enough to exercise it.
	t.Run("reconnect callbacks", func(t *testing.T) {
		registrySize := func(c *connection) int {
			c.mu.Lock()
			defer c.mu.Unlock()
			return len(c.reconnectCbs)
		}

		t.Run("fires every registered callback", func(t *testing.T) {
			c := newDisabledConnection()

			var first, second atomic.Int64
			c.onReconnect(func() { first.Add(1) })
			c.onReconnect(func() { second.Add(1) })
			require.Equal(t, 2, registrySize(c), "both callbacks must be registered")

			c.fireReconnect()
			require.EqualValues(t, 1, first.Load())
			require.EqualValues(t, 1, second.Load())

			// A second reconnect fires them again — the callback is not one-shot.
			c.fireReconnect()
			require.EqualValues(t, 2, first.Load())
			require.EqualValues(t, 2, second.Load())
		})

		t.Run("unregister drops only its own callback", func(t *testing.T) {
			c := newDisabledConnection()

			var first, second atomic.Int64
			removeFirst := c.onReconnect(func() { first.Add(1) })
			c.onReconnect(func() { second.Add(1) })

			// Removing must shrink the registry (not just stop firing) so callbacks
			// do not leak for the connection's lifetime.
			removeFirst()
			require.Equal(t, 1, registrySize(c), "unregistered callback must be dropped from the registry")

			c.fireReconnect()
			require.EqualValues(t, 0, first.Load(), "removed callback must not fire")
			require.EqualValues(t, 1, second.Load(), "remaining callback must keep firing")
		})

		t.Run("unregister is idempotent", func(t *testing.T) {
			c := newDisabledConnection()
			remove := c.onReconnect(func() {})
			require.NotPanics(t, func() {
				remove()
				remove()
			})
			require.Equal(t, 0, registrySize(c))
		})

		t.Run("fireReconnect with no callbacks is a no-op", func(t *testing.T) {
			require.NotPanics(t, newDisabledConnection().fireReconnect)
		})

		t.Run("a callback may register another without deadlocking", func(t *testing.T) {
			c := newDisabledConnection()

			var added atomic.Int64
			c.onReconnect(func() {
				c.onReconnect(func() { added.Add(1) })
			})

			// Callbacks are snapshotted under the lock and invoked outside it, so
			// registering during fireReconnect must not deadlock.
			require.NotPanics(t, c.fireReconnect)
			// The newly registered callback only fires on the next reconnect.
			c.fireReconnect()
			require.EqualValues(t, 1, added.Load())
		})
	})
}
