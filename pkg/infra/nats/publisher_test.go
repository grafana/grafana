package nats

import (
	"context"
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

func newTestPublisher(t *testing.T, srv *natsserver.Server) *publisher {
	t.Helper()
	cfg := setting.NATSSettings{Enabled: true, ClientURLs: []string{srv.ClientURL()}}
	m := newMetrics(prometheus.NewRegistry())
	p := newPublisher(cfg, log.NewNopLogger(), m, func() []string { return []string{srv.ClientURL()} })
	p.setExtraOptions(natsclient.InProcessServer(srv))
	t.Cleanup(p.close)
	return p
}

func TestPublisher_Disabled(t *testing.T) {
	m := newMetrics(prometheus.NewRegistry())
	p := newPublisher(setting.NATSSettings{Enabled: false}, log.NewNopLogger(), m, func() []string { return nil })

	require.False(t, p.Enabled())
	require.ErrorIs(t, p.Publish(context.Background(), "subj", []byte("x")), ErrDisabled)
}

func TestPublisher_Publish(t *testing.T) {
	srv := startTestServer(t)
	p := newTestPublisher(t, srv)
	ctx := context.Background()

	require.NoError(t, p.Publish(ctx, "grafana.test.a", []byte("hello")))
}

func TestPublisher_PublishAfterCloseFails(t *testing.T) {
	srv := startTestServer(t)
	p := newTestPublisher(t, srv)
	ctx := context.Background()

	require.NoError(t, p.Publish(ctx, "grafana.test.a", []byte("hello")))

	p.close()
	require.ErrorIs(t, p.Publish(ctx, "grafana.test.a", []byte("world")), ErrClosed)
}

func TestPublisher_PublishHonoursCancelledContext(t *testing.T) {
	srv := startTestServer(t)
	p := newTestPublisher(t, srv)

	// Warm the connection so get() succeeds and the cancellation is observed by
	// the explicit ctx.Err() check rather than during connect.
	require.NoError(t, p.Publish(context.Background(), "grafana.test.a", []byte("hello")))

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	require.ErrorIs(t, p.Publish(ctx, "grafana.test.a", []byte("world")), context.Canceled)
}
