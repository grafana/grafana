package nats

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"go.uber.org/goleak"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestMain(m *testing.M) {
	db.SetupTestDB()
	goleak.VerifyTestMain(m,
		goleak.Cleanup(func(exitCode int) {
			db.CleanupTestDB()
			os.Exit(exitCode)
		}),
		// OpenFeature starts a process-wide event dispatcher with no shutdown hook.
		// Inlining changes its reported name between normal and race builds.
		goleak.IgnoreTopFunction("github.com/open-feature/go-sdk/openfeature.(*eventExecutor).startEventListener.func1.1"),
		goleak.IgnoreTopFunction("github.com/open-feature/go-sdk/openfeature.newEventExecutor.(*eventExecutor).startEventListener.func1.1"),
	)
}

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

	t.Run("startup errors when no urls configured", func(t *testing.T) {
		cfg := setting.NATSSettings{Enabled: true}
		c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newConfig(cfg, nil), func() string { return "" })

		err := c.starting(context.Background())
		require.ErrorContains(t, err, "no nats client urls configured")
	})

	t.Run("get reuses the established connection", func(t *testing.T) {
		c := newTestConnection(t, startTestServer(t))
		require.NoError(t, c.starting(context.Background()))

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
		require.NoError(t, c.starting(context.Background()))

		_, err := c.get(context.Background())
		require.NoError(t, err)

		// The ConnectHandler fires asynchronously; wait for it to mark the role healthy.
		require.Eventually(t, func() bool {
			return testutil.ToFloat64(m.connectionStatus) == 1
		}, 5*time.Second, 10*time.Millisecond)
	})

	t.Run("get honours a cancelled context", func(t *testing.T) {
		c := newTestConnection(t, startTestServer(t))
		require.NoError(t, c.starting(context.Background()))

		_, err := c.get(context.Background())
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		_, err = c.get(ctx)
		require.ErrorIs(t, err, context.Canceled)
	})

	t.Run("get returns ErrClosed after close", func(t *testing.T) {
		c := newTestConnection(t, startTestServer(t))
		require.NoError(t, c.starting(context.Background()))

		_, err := c.get(context.Background())
		require.NoError(t, err)

		c.close()
		_, err = c.get(context.Background())
		require.ErrorIs(t, err, ErrClosed)
	})

	t.Run("get is safe for concurrent callers", func(t *testing.T) {
		c := newTestConnection(t, startTestServer(t))
		require.NoError(t, c.starting(context.Background()))

		var (
			wg    sync.WaitGroup
			mu    sync.Mutex
			conns = map[*natsclient.Conn]struct{}{}
		)
		for range 50 {
			wg.Go(func() {
				nc, err := c.get(context.Background())
				require.NoError(t, err)
				mu.Lock()
				conns[nc] = struct{}{}
				mu.Unlock()
			})
		}
		wg.Wait()

		// Concurrent callers must all share the single startup connection.
		require.Len(t, conns, 1)
	})

	t.Run("healthy", func(t *testing.T) {
		t.Run("disabled", func(t *testing.T) {
			require.ErrorIs(t, newDisabledConnection().healthy(), ErrDisabled)
		})

		t.Run("uninitialized", func(t *testing.T) {
			c := newTestConnection(t, startTestServer(t))
			require.Error(t, c.healthy())
		})

		t.Run("connected", func(t *testing.T) {
			c := newTestConnection(t, startTestServer(t))
			require.NoError(t, c.starting(context.Background()))
			_, err := c.get(context.Background())
			require.NoError(t, err)
			require.NoError(t, c.healthy())
		})

		t.Run("closed", func(t *testing.T) {
			c := newTestConnection(t, startTestServer(t))
			require.NoError(t, c.starting(context.Background()))
			c.close()
			require.ErrorIs(t, c.healthy(), ErrClosed)
		})
	})

	t.Run("close", func(t *testing.T) {
		t.Run("is idempotent", func(t *testing.T) {
			c := newTestConnection(t, startTestServer(t))
			require.NoError(t, c.starting(context.Background()))
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

	t.Run("redactURL", func(t *testing.T) {
		for _, tc := range []struct {
			name string
			raw  string
			want string
		}{
			{"empty", "", ""},
			{"no userinfo", "nats://us-nats.us-nats.svc.cluster.local:4222", "nats://us-nats.us-nats.svc.cluster.local:4222"},
			{"user and password", "nats://user:s3cret@host:4222", "nats://host:4222"},
			{"token only", "nats://s3cret@host:4222", "nats://host:4222"},
			{"unparseable", "nats://host:4222/\x7f", "<invalid url>"},
		} {
			t.Run(tc.name, func(t *testing.T) {
				got := redactURL(tc.raw)
				require.Equal(t, tc.want, got)
				require.NotContains(t, got, "s3cret")
			})
		}
	})

	t.Run("redactURLs joins every url with credentials stripped", func(t *testing.T) {
		got := redactURLs([]string{"nats://user:s3cret@a:4222", "nats://b:4222"})
		require.Equal(t, "nats://a:4222,nats://b:4222", got)
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
			require.True(t, o.IgnoreAuthErrorAbort)
		})

		t.Run("all roles and auth modes retry through NATS", func(t *testing.T) {
			credsFile := filepath.Join(t.TempDir(), "test.creds")
			require.NoError(t, os.WriteFile(credsFile, []byte("dummy"), 0o600))
			for _, role := range []connRole{rolePublisher, roleSubscriber} {
				for _, mode := range []setting.NATSAuthMode{setting.NATSAuthModeNone, setting.NATSAuthModeToken, setting.NATSAuthModeCredentials, setting.NATSAuthModeTokenExchange} {
					t.Run(string(role)+"/"+string(mode), func(t *testing.T) {
						cfg := setting.NATSSettings{Enabled: true, Auth: setting.NATSAuthSettings{Mode: mode}}
						c := newConnection(role, log.NewNopLogger(), newConnectionMetrics(role), newConfig(cfg, nil), func() string { return credsFile })
						opts, err := c.connectOptions()
						require.NoError(t, err)
						o := applyOptions(t, opts)
						require.True(t, o.IgnoreAuthErrorAbort)
						require.True(t, o.RetryOnFailedConnect)
						require.Equal(t, -1, o.MaxReconnect)
					})
				}
			}
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

func TestConnectionLifecycle(t *testing.T) {
	for _, role := range []connRole{rolePublisher, roleSubscriber} {
		t.Run(string(role), func(t *testing.T) {
			srv := startTestServer(t)
			cfg := newTestConfig(srv, setting.NATSSettings{Enabled: true})
			c, svc, operation := newTestClient(t, role, cfg)
			require.Error(t, c.healthy())
			require.ErrorIs(t, operation(), natsclient.ErrConnectionClosed)
			require.Nil(t, c.conn)
			require.Zero(t, srv.NumClients())

			startService(t, t.Context(), svc)
			first, err := c.get(t.Context())
			require.NoError(t, err)
			require.NoError(t, c.healthy())
			require.NoError(t, operation())
			require.Equal(t, 1, srv.NumClients())

			first.Close()
			require.Error(t, c.healthy())
			require.ErrorIs(t, operation(), natsclient.ErrConnectionClosed)
			require.Error(t, svc.StartAsync(t.Context()))
			require.Same(t, first, c.conn)
			require.ErrorIs(t, operation(), natsclient.ErrConnectionClosed)
			c.close()
			require.ErrorIs(t, operation(), ErrClosed)
		})
	}
}

func TestNATSStartupRecovery(t *testing.T) {
	for _, outage := range []string{"broker unavailable", "repeated authentication rejection"} {
		t.Run(outage, func(t *testing.T) {
			listener, err := net.Listen("tcp", "127.0.0.1:0")
			require.NoError(t, err)
			port := listener.Addr().(*net.TCPAddr).Port
			require.NoError(t, listener.Close())
			var srv *natsserver.Server
			if outage == "repeated authentication rejection" {
				srv = startLifecycleServer(t, port, "wrong-token")
			}
			cfg := newConfig(setting.NATSSettings{
				Enabled: true, Mode: setting.NATSModeExternal,
				ClientURLs: []string{fmt.Sprintf("nats://127.0.0.1:%d", port)},
				Auth:       setting.NATSAuthSettings{Mode: setting.NATSAuthModeToken, Token: "right-token"},
			}, nil)
			pub := newPublisher(log.NewNopLogger(), newPublisherMetrics(), cfg)
			sub := newSubscriber(log.NewNopLogger(), newSubscriberMetrics(), cfg)
			startService(t, t.Context(), pub)
			startService(t, t.Context(), sub)
			pubConn, err := pub.get(t.Context())
			require.NoError(t, err)
			subConn, err := sub.get(t.Context())
			require.NoError(t, err)
			require.Error(t, pub.Health(t.Context()))
			require.Error(t, sub.Health(t.Context()))
			require.ErrorIs(t, pub.Publish(t.Context(), "test", nil), natsclient.ErrConnectionReconnecting)
			received := make(chan string, 4)
			var reconnects atomic.Int64
			subscription, err := sub.Subscribe(t.Context(), "test", func(_ string, data []byte) { received <- string(data) }, WithOnReconnect(func() { reconnects.Add(1) }))
			require.NoError(t, err)
			if srv != nil {
				require.Eventually(t, func() bool {
					return pubConn.Stats().Reconnects >= 3 && subConn.Stats().Reconnects >= 3
				}, 15*time.Second, 10*time.Millisecond)
				require.False(t, pubConn.IsClosed())
				require.False(t, subConn.IsClosed())
				srv.Shutdown()
				srv.WaitForShutdown()
			}
			srv = startLifecycleServer(t, port, "right-token")
			assertDelivery := func(message string) {
				t.Helper()
				require.Eventually(t, func() bool { return pub.Health(t.Context()) == nil && sub.Health(t.Context()) == nil }, 10*time.Second, 10*time.Millisecond)
				waitSubscriberReady(t, t.Context(), subscription)
				require.NoError(t, pub.Publish(t.Context(), "test", []byte(message)))
				select {
				case got := <-received:
					require.Equal(t, message, got)
				case <-time.After(5 * time.Second):
					t.Fatal("subscription did not receive message")
				}
				currentPub, err := pub.get(t.Context())
				require.NoError(t, err)
				currentSub, err := sub.get(t.Context())
				require.NoError(t, err)
				require.Same(t, pubConn, currentPub)
				require.Same(t, subConn, currentSub)
			}
			assertDelivery("initial recovery")
			srv.Shutdown()
			srv.WaitForShutdown()
			require.Eventually(t, func() bool { return pubConn.IsReconnecting() && subConn.IsReconnecting() }, 5*time.Second, 10*time.Millisecond)
			require.Error(t, pub.Health(t.Context()))
			require.Error(t, sub.Health(t.Context()))
			startLifecycleServer(t, port, "right-token")
			assertDelivery("subscription restored")
			require.Eventually(t, func() bool { return reconnects.Load() > 0 }, time.Second, time.Millisecond)
		})
	}
}

func TestConnectionEmbeddedStartup(t *testing.T) {
	for _, role := range []connRole{rolePublisher, roleSubscriber} {
		t.Run(string(role), func(t *testing.T) {
			server := &Server{cfg: setting.NATSSettings{Enabled: true, Mode: setting.NATSModeEmbedded}}
			cfg := newConfig(server.cfg, server)
			c, _, _ := newTestClient(t, role, cfg)
			done := make(chan error, 1)
			go func() { done <- c.starting(t.Context()) }()
			select {
			case err := <-done:
				t.Fatalf("startup returned before embedded URL was ready: %v", err)
			case <-time.After(30 * time.Millisecond):
			}
			srv := startTestServer(t)
			server.mu.Lock()
			server.server = srv
			server.mu.Unlock()
			select {
			case err := <-done:
				require.NoError(t, err)
			case <-time.After(5 * time.Second):
				t.Fatal("startup did not complete")
			}
			require.NoError(t, c.healthy())
		})
	}
}

func TestConnectionInterruptedDial(t *testing.T) {
	for _, stop := range []string{"cancellation", "shutdown"} {
		t.Run(stop, func(t *testing.T) {
			srv := startLifecycleServer(t, natsserver.RANDOM_PORT, "right-token")
			c, svc, exchanger, unblock := newTestBlockedClient(t, srv.ClientURL())
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			require.NoError(t, svc.StartAsync(ctx))
			select {
			case <-exchanger.entered:
			case <-time.After(5 * time.Second):
				t.Fatal("dial did not reach token exchange")
			}
			if stop == "cancellation" {
				cancel()
			} else {
				svc.StopAsync()
			}
			stoppedCtx, stopCancel := context.WithTimeout(t.Context(), time.Second)
			defer stopCancel()
			require.NoError(t, svc.AwaitTerminated(stoppedCtx))
			require.Error(t, svc.StartAsync(t.Context()))
			unblock()
			// The late successful dial must be closed rather than installed or orphaned.
			require.Eventually(t, func() bool {
				stats, err := srv.Varz(nil)
				return err == nil && stats.TotalConnections == 1 && stats.Connections == 0
			}, 5*time.Second, 10*time.Millisecond)
			require.Nil(t, c.conn)
			require.EqualValues(t, 1, exchanger.calls.Load())
		})
	}
}
