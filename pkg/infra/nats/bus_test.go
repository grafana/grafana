package nats

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// startTestServer starts an in-process embedded NATS server (no TCP listener)
// for tests, exercising the same in-process path the embedded production mode
// uses. This keeps tests hermetic and free of port-collision flakiness.
func startTestServer(t *testing.T) *natsserver.Server {
	t.Helper()
	srv, err := natsserver.NewServer(&natsserver.Options{
		DontListen:      true, // in-process only
		NoLog:           true,
		NoSigs:          true,
		JetStream:       false,
		NoSystemAccount: true,
	})
	require.NoError(t, err)
	go srv.Start()
	require.True(t, srv.ReadyForConnections(5*time.Second), "test nats server not ready")
	t.Cleanup(srv.Shutdown)
	return srv
}

func newTestBus(t *testing.T, srv *natsserver.Server) *bus {
	t.Helper()
	cfg := setting.NATSSettings{Enabled: true, ClientURLs: []string{srv.ClientURL()}}
	m := newMetrics(prometheus.NewRegistry())
	b := newBus(cfg, log.NewNopLogger(), m, func() []string { return []string{srv.ClientURL()} })
	b.setExtraOptions(natsclient.InProcessServer(srv))
	t.Cleanup(b.close)
	return b
}

func TestBus_Disabled(t *testing.T) {
	m := newMetrics(prometheus.NewRegistry())
	b := newBus(setting.NATSSettings{Enabled: false}, log.NewNopLogger(), m, func() []string { return nil })

	require.False(t, b.Enabled())
	require.ErrorIs(t, b.Publish(context.Background(), "subj", []byte("x")), ErrDisabled)
	_, err := b.Subscribe(context.Background(), "subj")
	require.ErrorIs(t, err, ErrDisabled)
}

func TestBus_PublishSubscribe(t *testing.T) {
	srv := startTestServer(t)
	b := newTestBus(t, srv)
	ctx := context.Background()

	sub, err := b.Subscribe(ctx, "grafana.test.>")
	require.NoError(t, err)
	defer func() { require.NoError(t, sub.Close()) }()

	require.NoError(t, b.Publish(ctx, "grafana.test.a", []byte("hello")))

	select {
	case msg := <-sub.C():
		require.Equal(t, "grafana.test.a", msg.Subject)
		require.Equal(t, []byte("hello"), msg.Data)
	case <-time.After(2 * time.Second):
		t.Fatal("did not receive message")
	}
}

func TestBus_QueueGroup_LoadBalances(t *testing.T) {
	srv := startTestServer(t)
	b := newTestBus(t, srv)
	ctx := context.Background()

	var got1, got2 atomic.Int64
	sub1, err := b.Subscribe(ctx, "grafana.q.>", WithQueueGroup("workers"))
	require.NoError(t, err)
	defer func() { _ = sub1.Close() }()
	sub2, err := b.Subscribe(ctx, "grafana.q.>", WithQueueGroup("workers"))
	require.NoError(t, err)
	defer func() { _ = sub2.Close() }()

	done := make(chan struct{})
	go func() {
		for {
			select {
			case <-sub1.C():
				got1.Add(1)
			case <-sub2.C():
				got2.Add(1)
			case <-done:
				return
			}
		}
	}()

	const total = 50
	for i := 0; i < total; i++ {
		require.NoError(t, b.Publish(ctx, "grafana.q.x", []byte("m")))
	}

	require.Eventually(t, func() bool {
		return got1.Load()+got2.Load() == total
	}, 3*time.Second, 10*time.Millisecond, "queue group did not deliver all messages exactly once")
	close(done)

	// Each member should get a share; with a queue group neither should get all.
	require.Greater(t, got1.Load(), int64(0))
	require.Greater(t, got2.Load(), int64(0))
}

func TestBus_Subscribe_ContextCancelClosesChannel(t *testing.T) {
	srv := startTestServer(t)
	b := newTestBus(t, srv)

	ctx, cancel := context.WithCancel(context.Background())
	sub, err := b.Subscribe(ctx, "grafana.cancel.>")
	require.NoError(t, err)

	cancel()
	require.Eventually(t, func() bool {
		_, open := <-sub.C()
		return !open
	}, 2*time.Second, 10*time.Millisecond, "channel not closed after context cancel")
}
