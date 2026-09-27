package nats

import (
	"context"
	"errors"
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"
	promtestutil "github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationEmbeddedServer drives the full embedded-server stack end-to-end via
// the real Provide* constructors and dskit lifecycle, delivering messages over the
// in-process client hop that production embedded mode uses.
func TestIntegrationEmbeddedServer(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("publisher buffer overflows and recovers after reconnect", testPublisherBufferOverflowRecovers)
	t.Run("publisher requires first success for every connection", testPublisherFirstSuccess)
	t.Run("publishing fails when the server rejects authentication", testPublishingFailsOnAuthRejection)
	t.Run("single subscriber receives a published message", testSingleSubscriberReceives)
	t.Run("queue group delivers each message to exactly one subscriber", testQueueGroupDeliversOnce)
	t.Run("two independent subscribers each receive the message (fan-out)", testFanOutDelivery)
	t.Run("wildcard subscription receives every matching subject", testWildcardSubscription)
	t.Run("a message published before subscription is not replayed", testNoReplayBeforeSubscription)
	t.Run("concurrent publishers all deliver to a single subscriber", testConcurrentPublishers)
}

func testPublisherBufferOverflowRecovers(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	start := func(port int) *natsserver.Server {
		s, err := natsserver.NewServer(&natsserver.Options{
			Host: "127.0.0.1", Port: port, NoLog: true, NoSigs: true,
			JetStream: false, NoSystemAccount: true,
		})
		require.NoError(t, err)
		go s.Start()
		require.True(t, s.ReadyForConnections(5*time.Second))
		return s
	}

	srv := start(natsserver.RANDOM_PORT)
	port := srv.Addr().(*net.TCPAddr).Port
	defer func() { srv.Shutdown() }()
	cfg := setting.NATSSettings{Enabled: true, Mode: setting.NATSModeExternal, ClientURLs: []string{fmt.Sprintf("nats://127.0.0.1:%d", port)}}
	natsCfg := newConfig(cfg, nil)
	pub := newPublisher(log.NewNopLogger(), newPublisherMetrics(), natsCfg)
	// pub is used directly (not started as a service), so close it to stop the reconnect loop.
	t.Cleanup(pub.close)
	require.NoError(t, pub.starting(ctx))
	sub := newSubscriber(log.NewNopLogger(), newSubscriberMetrics(), natsCfg)
	startService(t, ctx, sub)

	const subject = "grafana.integration.reconnect"
	received := make(chan string, 256)
	warmupSub, err := sub.Subscribe(ctx, subject, func(_ string, data []byte) {
		received <- string(data)
	})
	require.NoError(t, err)
	// Wait for interest to register before publishing; core NATS drops messages with no matching interest.
	waitSubscriberReady(t, ctx, warmupSub)
	require.NoError(t, pub.Publish(ctx, subject, []byte("warmup")))
	select {
	case msg := <-received:
		require.Equal(t, "warmup", msg)
	case <-time.After(5 * time.Second):
		t.Fatal("warm-up message was not delivered")
	}

	sub.close()
	srv.Shutdown()
	require.Eventually(t, func() bool {
		pub.mu.Lock()
		defer pub.mu.Unlock()
		return pub.conn != nil && !pub.conn.IsConnected()
	}, 5*time.Second, 10*time.Millisecond)

	payload := make([]byte, 64*1024)
	accepted := make([]string, 0, 256)
	for i := 0; ; i++ {
		message := fmt.Sprintf("%08d:%s", i, payload)
		err := pub.Publish(ctx, subject, []byte(message))
		if errors.Is(err, natsclient.ErrReconnectBufExceeded) {
			break
		}
		require.NoError(t, err)
		accepted = append(accepted, message)
	}
	// A non-empty accepted set proves messages were buffered while disconnected.
	require.NotEmpty(t, accepted)

	// The publisher reconnects on its own and replays its buffer the moment the
	// server accepts connections. Start the recovery broker only just after a
	// failed reconnect attempt, so the publisher is parked in its ReconnectWait
	// backoff and cannot replay before recoverySub registers interest. Core NATS
	// drops messages published with no matching interest.
	attemptsBefore := promtestutil.ToFloat64(pub.metrics.connectionErrors)
	require.Eventually(t, func() bool {
		return promtestutil.ToFloat64(pub.metrics.connectionErrors) > attemptsBefore
	}, 5*time.Second, 10*time.Millisecond)

	srv = start(port)
	recoverySub := newTestSubscriber(t, srv)
	startService(t, ctx, recoverySub)
	recovery, err := recoverySub.Subscribe(ctx, subject, func(_ string, data []byte) {
		received <- string(data)
	})
	require.NoError(t, err)
	// Register recovery interest before the publisher reconnects and replays its buffer.
	waitSubscriberReady(t, ctx, recovery)
	// nats.go replays the reconnect buffer automatically once it reconnects; just
	// wait for that to happen.
	require.Eventually(t, func() bool {
		pub.mu.Lock()
		defer pub.mu.Unlock()
		return pub.conn != nil && pub.conn.IsConnected()
	}, 10*time.Second, 50*time.Millisecond)

	// Match only against the accepted set; never assert on the multi-KB payloads directly
	// (a failed require.Contains would render them and overflow bufio.Scanner).
	acceptedSet := make(map[string]struct{}, len(accepted))
	for _, message := range accepted {
		acceptedSet[message] = struct{}{}
	}
	seen := make(map[string]struct{}, len(accepted))
	for len(seen) < len(accepted) {
		select {
		case message := <-received:
			if _, ok := acceptedSet[message]; ok {
				seen[message] = struct{}{}
			}
		case <-time.After(15 * time.Second):
			t.Fatalf("received %d/%d buffered messages", len(seen), len(accepted))
		}
	}
}

func testPublisherFirstSuccess(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	port := listener.Addr().(*net.TCPAddr).Port
	require.NoError(t, listener.Close())
	ctx := context.Background()
	cfg := setting.NATSSettings{
		Enabled: true, Mode: setting.NATSModeExternal,
		ClientURLs: []string{fmt.Sprintf("nats://127.0.0.1:%d", port)},
	}
	pub := newPublisher(log.NewNopLogger(), newPublisherMetrics(), newConfig(cfg, nil))
	t.Cleanup(pub.close)
	require.NoError(t, pub.starting(ctx))
	require.ErrorIs(t, pub.Publish(ctx, "test", []byte("before")), natsclient.ErrConnectionReconnecting)

	srv, err := natsserver.NewServer(&natsserver.Options{
		Host: "127.0.0.1", Port: port, NoLog: true, NoSigs: true,
	})
	require.NoError(t, err)
	go srv.Start()
	t.Cleanup(srv.Shutdown)
	require.True(t, srv.ReadyForConnections(5*time.Second))
	require.Eventually(t, func() bool {
		return pub.Publish(ctx, "test", []byte("after")) == nil
	}, 5*time.Second, 20*time.Millisecond)

	nc, err := pub.get(ctx)
	require.NoError(t, err)
	srv.Shutdown()
	srv.WaitForShutdown()
	require.Eventually(t, nc.IsReconnecting, 5*time.Second, 10*time.Millisecond)
	require.NoError(t, pub.Publish(ctx, "test", []byte("buffered")))

	nc.Close()
	require.ErrorIs(t, pub.Publish(ctx, "test", []byte("replacement")), natsclient.ErrConnectionClosed)
}

func testPublishingFailsOnAuthRejection(t *testing.T) {
	srv, err := natsserver.NewServer(&natsserver.Options{
		Host: "127.0.0.1", Port: natsserver.RANDOM_PORT, NoLog: true, NoSigs: true,
		JetStream: false, NoSystemAccount: true,
		Authorization: "right-token",
	})
	require.NoError(t, err)
	go srv.Start()
	require.True(t, srv.ReadyForConnections(5*time.Second))
	t.Cleanup(srv.Shutdown)
	port := srv.Addr().(*net.TCPAddr).Port

	// Authentication can recover, but messages must not be accepted before
	// the connection has authenticated successfully.
	cfg := setting.NATSSettings{
		Enabled:    true,
		Mode:       setting.NATSModeExternal,
		ClientURLs: []string{fmt.Sprintf("nats://127.0.0.1:%d", port)},
		Auth:       setting.NATSAuthSettings{Mode: setting.NATSAuthModeToken, Token: "wrong-token"},
	}
	pub := newPublisher(log.NewNopLogger(), newPublisherMetrics(), newConfig(cfg, nil))
	t.Cleanup(pub.close)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	t.Cleanup(cancel)
	require.NoError(t, pub.starting(ctx))
	require.ErrorIs(t, pub.Publish(ctx, "grafana.test.auth", []byte("hello")), natsclient.ErrConnectionReconnecting)
	require.Zero(t, promtestutil.ToFloat64(pub.metrics.messagesAccepted))
}

// waitSubscriberReady blocks until the subscription's interest is registered on the server.
func waitSubscriberReady(t *testing.T, ctx context.Context, sub Subscription) {
	t.Helper()
	readyCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	require.NoError(t, sub.WaitReady(readyCtx))
}

func testSingleSubscriberReceives(t *testing.T) {
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
}

func testQueueGroupDeliversOnce(t *testing.T) {
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
}

func testFanOutDelivery(t *testing.T) {
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
}

func testWildcardSubscription(t *testing.T) {
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
}

func testNoReplayBeforeSubscription(t *testing.T) {
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
}

func testConcurrentPublishers(t *testing.T) {
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
		wg.Go(func() {
			for range perPublisher {
				if err := pub.Publish(ctx, subject, []byte("x")); err != nil {
					t.Errorf("publish: %v", err)
				}
			}
		})
	}
	wg.Wait()

	require.Eventually(t, func() bool {
		return count.Load() == stable+int64(total)
	}, 5*time.Second, time.Millisecond)
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
		// Let NATS bind ephemeral ports atomically so parallel or repeated runs —
		// and a dev Grafana already holding 4222 — don't collide.
		ClientPort:  natsserver.RANDOM_PORT,
		ClusterPort: natsserver.RANDOM_PORT,
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
