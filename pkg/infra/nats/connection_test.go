package nats

import (
	"context"
	"os"
	"path/filepath"
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

// applyOptions resolves a set of nats options into a concrete Options struct so a
// test can assert which auth mechanism connectOptions selected.
func applyOptions(t *testing.T, opts []natsclient.Option) *natsclient.Options {
	t.Helper()
	var o natsclient.Options
	for _, opt := range opts {
		require.NoError(t, opt(&o))
	}
	return &o
}

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

		t.Run("token mode uses the static token", func(t *testing.T) {
			cfg := setting.NATSSettings{Enabled: true, Auth: setting.NATSAuthSettings{Mode: setting.NATSAuthModeToken, Token: "s3cret"}}
			c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() string { return "" })

			opts, err := c.connectOptions()
			require.NoError(t, err)
			o := applyOptions(t, opts)
			require.Equal(t, "s3cret", o.Token)
			require.Nil(t, o.TokenHandler)
		})

		t.Run("token_exchange mode registers a token handler", func(t *testing.T) {
			cfg := setting.NATSSettings{Enabled: true, Auth: setting.NATSAuthSettings{
				Mode:                   setting.NATSAuthModeTokenExchange,
				Token:                  "s3cret",
				TokenExchangeAudiences: []string{"us-nats"},
				TokenExchangeURL:       "http://signer/sign",
				TokenExchangeToken:     "boot-token",
			}}
			c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() string { return "" })

			opts, err := c.connectOptions()
			require.NoError(t, err)
			o := applyOptions(t, opts)
			// The mode selects token exchange: a handler is installed and the static
			// token is left unset even though one is present.
			require.NotNil(t, o.TokenHandler)
			require.Empty(t, o.Token)
		})

		t.Run("credentials mode uses the creds file", func(t *testing.T) {
			credsFile := filepath.Join(t.TempDir(), "pub.creds")
			require.NoError(t, os.WriteFile(credsFile, []byte("dummy"), 0o600))

			cfg := setting.NATSSettings{Enabled: true, Auth: setting.NATSAuthSettings{
				Mode:                     setting.NATSAuthModeCredentials,
				PublisherCredentialsFile: credsFile,
				TokenExchangeAudiences:   []string{"us-nats"},
				TokenExchangeURL:         "http://signer/sign",
				TokenExchangeToken:       "boot-token",
			}}
			config := newConfig(cfg, nil)
			c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), config, config.PublisherCredentials)

			opts, err := c.connectOptions()
			require.NoError(t, err)
			o := applyOptions(t, opts)
			// The mode selects credentials: the .creds file is loaded and neither the
			// token handler nor a static token is installed.
			require.NotNil(t, o.UserJWT)
			require.Nil(t, o.TokenHandler)
			require.Empty(t, o.Token)
		})

		t.Run("none mode installs no auth", func(t *testing.T) {
			cfg := setting.NATSSettings{Enabled: true, Auth: setting.NATSAuthSettings{
				Mode:  setting.NATSAuthModeNone,
				Token: "s3cret",
			}}
			c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() string { return "" })

			opts, err := c.connectOptions()
			require.NoError(t, err)
			o := applyOptions(t, opts)
			require.Empty(t, o.Token)
			require.Nil(t, o.TokenHandler)
			require.Nil(t, o.UserJWT)
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
