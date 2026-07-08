package nats

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationEmbeddedServer drives the full embedded-server stack end-to-end via
// the real Provide* constructors and dskit lifecycle, delivering messages over the
// in-process client hop that production embedded mode uses.
func TestIntegrationEmbeddedServer(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("single subscriber receives a published message", func(t *testing.T) {
		ctx, _, pub, sub := startEmbeddedStack(t)

		const subject = "grafana.integration.single"
		received := make(chan []byte, 1)
		_, err := sub.Subscribe(ctx, subject, func(_ string, data []byte) {
			select {
			case received <- data:
			default:
			}
		})
		require.NoError(t, err)

		// SUB interest propagates asynchronously, so retry until it lands.
		require.Eventually(t, func() bool {
			require.NoError(t, pub.Publish(ctx, subject, []byte("hello")))
			select {
			case got := <-received:
				require.Equal(t, []byte("hello"), got)
				return true
			case <-time.After(20 * time.Millisecond):
				return false
			}
		}, 5*time.Second, time.Millisecond)
	})

	t.Run("queue group delivers each message to exactly one subscriber", func(t *testing.T) {
		ctx, server, pub, sub1 := startEmbeddedStack(t)
		sub2 := startExtraSubscriber(t, ctx, server)

		const (
			subject  = "grafana.integration.queue"
			messages = 20
		)
		var total atomic.Int64

		_, err := sub1.Subscribe(ctx, subject, func(_ string, _ []byte) { total.Add(1) }, WithQueueGroup("workers"))
		require.NoError(t, err)
		_, err = sub2.Subscribe(ctx, subject, func(_ string, _ []byte) { total.Add(1) }, WithQueueGroup("workers"))
		require.NoError(t, err)

		require.Eventually(t, func() bool {
			_ = pub.Publish(ctx, subject, []byte("work"))
			return total.Load() > 0
		}, 5*time.Second, time.Millisecond)

		// Snapshot the baseline once warm-up deliveries settle (count stops rising),
		// so in-flight messages don't skew the batch assertion.
		var stable int64
		require.Eventually(t, func() bool {
			if c := total.Load(); c > stable {
				stable = c
				return false
			}
			return true
		}, time.Second, 20*time.Millisecond)

		for range messages {
			require.NoError(t, pub.Publish(ctx, subject, []byte("work")))
		}

		// Core NATS never double-delivers, so reaching baseline+messages proves each
		// message was delivered to exactly one member of the group.
		require.Eventually(t, func() bool {
			return total.Load() == stable+int64(messages)
		}, 5*time.Second, time.Millisecond)
	})

	t.Run("two independent subscribers each receive the message (fan-out)", func(t *testing.T) {
		ctx, server, pub, sub1 := startEmbeddedStack(t)
		sub2 := startExtraSubscriber(t, ctx, server)

		const subject = "grafana.integration.fanout"
		ch1, ch2 := make(chan []byte, 1), make(chan []byte, 1)
		deliver := func(ch chan []byte) MessageHandler {
			return func(_ string, data []byte) {
				select {
				case ch <- data:
				default:
				}
			}
		}
		_, err := sub1.Subscribe(ctx, subject, deliver(ch1))
		require.NoError(t, err)
		_, err = sub2.Subscribe(ctx, subject, deliver(ch2))
		require.NoError(t, err)

		var got1, got2 []byte
		require.Eventually(t, func() bool {
			require.NoError(t, pub.Publish(ctx, subject, []byte("fanout")))
			select {
			case got1 = <-ch1:
			case <-time.After(10 * time.Millisecond):
			}
			select {
			case got2 = <-ch2:
			case <-time.After(10 * time.Millisecond):
			}
			return got1 != nil && got2 != nil
		}, 5*time.Second, time.Millisecond)

		require.Equal(t, []byte("fanout"), got1)
		require.Equal(t, []byte("fanout"), got2)
	})

	t.Run("wildcard subscription receives every matching subject", func(t *testing.T) {
		ctx, _, pub, sub := startEmbeddedStack(t)

		// A "*" token matches any single subject token, e.g. the namespace position
		// that resourcewatch.Subject fills with "*" to watch all namespaces.
		const (
			wildcard = "grafana.integration.wild.*"
			warmup   = "grafana.integration.wild.warmup"
			subjectA = "grafana.integration.wild.ns1"
			subjectB = "grafana.integration.wild.ns2"
		)
		got := make(chan string, 16)
		_, err := sub.Subscribe(ctx, wildcard, func(subj string, _ []byte) {
			select {
			case got <- subj:
			default:
			}
		})
		require.NoError(t, err)

		require.Eventually(t, func() bool {
			require.NoError(t, pub.Publish(ctx, warmup, []byte("x")))
			select {
			case <-got:
				return true
			case <-time.After(20 * time.Millisecond):
				return false
			}
		}, 5*time.Second, time.Millisecond)

		require.NoError(t, pub.Publish(ctx, subjectA, []byte("a")))
		require.NoError(t, pub.Publish(ctx, subjectB, []byte("b")))

		seen := map[string]bool{}
		require.Eventually(t, func() bool {
			select {
			case subj := <-got:
				seen[subj] = true
			case <-time.After(20 * time.Millisecond):
			}
			return seen[subjectA] && seen[subjectB]
		}, 5*time.Second, time.Millisecond)
	})

	t.Run("a message published before subscription is not replayed", func(t *testing.T) {
		ctx, _, pub, sub := startEmbeddedStack(t)

		const subject = "grafana.integration.noreplay"

		// Core NATS has no persistence: with no registered interest this message is
		// dropped, not queued for a future subscriber.
		require.NoError(t, pub.Publish(ctx, subject, []byte("early")))

		// Publish is fire-and-forget, so "early" may still sit in the publisher's
		// outbound buffer. Flush it (a PING/PONG round-trip) so the server has
		// definitely processed — and, with no interest yet, dropped — "early" before
		// we subscribe. Otherwise the SUB can register interest before "early"
		// reaches the server and the subscriber would receive it.
		nc, err := pub.get(ctx)
		require.NoError(t, err)
		require.NoError(t, nc.Flush())

		got := make(chan []byte, 16)
		_, err = sub.Subscribe(ctx, subject, func(_ string, data []byte) {
			got <- append([]byte(nil), data...)
		})
		require.NoError(t, err)

		// Every delivery must be a post-subscription "live" message; the pre-
		// subscription "early" one is never replayed.
		require.Eventually(t, func() bool {
			require.NoError(t, pub.Publish(ctx, subject, []byte("live")))
			select {
			case data := <-got:
				require.Equal(t, []byte("live"), data)
				return true
			case <-time.After(20 * time.Millisecond):
				return false
			}
		}, 5*time.Second, time.Millisecond)

		for {
			select {
			case data := <-got:
				require.Equal(t, []byte("live"), data)
			case <-time.After(100 * time.Millisecond):
				return
			}
		}
	})

	t.Run("concurrent publishers all deliver to a single subscriber", func(t *testing.T) {
		ctx, _, pub, sub := startEmbeddedStack(t)

		const (
			subject      = "grafana.integration.concurrent"
			publishers   = 8
			perPublisher = 25
			total        = publishers * perPublisher
		)
		var count atomic.Int64
		_, err := sub.Subscribe(ctx, subject, func(_ string, _ []byte) { count.Add(1) })
		require.NoError(t, err)

		require.Eventually(t, func() bool {
			_ = pub.Publish(ctx, subject, []byte("warmup"))
			return count.Load() > 0
		}, 5*time.Second, time.Millisecond)

		// Settle warm-up deliveries before snapshotting the baseline, so in-flight
		// messages don't inflate the burst count.
		var stable int64
		require.Eventually(t, func() bool {
			if c := count.Load(); c > stable {
				stable = c
				return false
			}
			return true
		}, time.Second, 20*time.Millisecond)

		// Publish the burst from many goroutines through the shared connection; the
		// -race build asserts it stays thread-safe.
		var wg sync.WaitGroup
		for range publishers {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for range perPublisher {
					if err := pub.Publish(ctx, subject, []byte("x")); err != nil {
						t.Errorf("publish: %v", err)
					}
				}
			}()
		}
		wg.Wait()

		require.Eventually(t, func() bool {
			return count.Load() == stable+int64(total)
		}, 5*time.Second, time.Millisecond)
	})
}

// startEmbeddedStack boots the embedded server plus a publisher and subscriber,
// returning a context cancelled at test end.
func startEmbeddedStack(t *testing.T) (context.Context, *Server, *PublisherService, *SubscriberService) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{
		Enabled:       true,
		Mode:          setting.NATSModeEmbedded,
		ListenAddress: "127.0.0.1",
		// Bind free ports rather than the conventional 4222/6222 so parallel or
		// repeated runs — and a dev Grafana already holding 4222 — don't collide;
		// clients connect via the server's actual ClientURL. A zero ClusterPort
		// leaves ClusterAddr() nil, which routeURLForServer dereferences.
		ClientPort:  freePort(t),
		ClusterPort: freePort(t),
	}

	server, err := ProvideServer(cfg, nil, prometheus.NewRegistry())
	require.NoError(t, err)
	startService(t, ctx, server)

	natsCfg := ProvideNATSConfig(cfg, server)
	pub := ProvidePublisher(natsCfg, prometheus.NewRegistry())
	sub := ProvideSubscriber(natsCfg, prometheus.NewRegistry())
	startService(t, ctx, pub)
	startService(t, ctx, sub)

	return ctx, server, pub, sub
}

// startExtraSubscriber adds a second subscriber wired to an already-running server.
func startExtraSubscriber(t *testing.T, ctx context.Context, server *Server) *SubscriberService {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{Enabled: true, Mode: setting.NATSModeEmbedded}
	sub := ProvideSubscriber(ProvideNATSConfig(cfg, server), prometheus.NewRegistry())
	startService(t, ctx, sub)
	return sub
}
