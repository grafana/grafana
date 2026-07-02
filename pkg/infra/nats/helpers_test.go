package nats

import (
	"context"
	"net"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// histogramSampleCount reads the number of observations recorded by a single
// histogram (e.g. one label combination of a HistogramVec).
func histogramSampleCount(t *testing.T, h prometheus.Observer) uint64 {
	t.Helper()
	collector, ok := h.(prometheus.Collector)
	require.True(t, ok, "observer is not a collector")

	ch := make(chan prometheus.Metric, 1)
	collector.Collect(ch)
	close(ch)

	var m dto.Metric
	require.NoError(t, (<-ch).Write(&m))
	return m.GetHistogram().GetSampleCount()
}

// startTestServer starts an in-process embedded NATS server (no TCP listener),
// exercising the same in-process path the embedded production mode uses. This
// keeps tests hermetic and free of port-collision flakiness.
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

// newTestConfig wires a shared connection config to the in-process test server,
// mirroring how the Config reads the embedded server from the Server at runtime.
func newTestConfig(srv *natsserver.Server, cfg setting.NATSSettings) *Config {
	return newConfig(cfg, &Server{server: srv})
}

func newTestConnection(t *testing.T, srv *natsserver.Server) *connection {
	t.Helper()
	cfg := setting.NATSSettings{Enabled: true}
	c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newTestConfig(srv, cfg), func() string { return "" })
	t.Cleanup(c.close)
	return c
}

func newTestPublisher(t *testing.T, srv *natsserver.Server) *PublisherService {
	t.Helper()
	cfg := setting.NATSSettings{Enabled: true}
	p := newPublisher(log.NewNopLogger(), newPublisherMetrics(), newTestConfig(srv, cfg))
	t.Cleanup(p.close)
	return p
}

func newTestSubscriber(t *testing.T, srv *natsserver.Server) *SubscriberService {
	t.Helper()
	cfg := setting.NATSSettings{Enabled: true}
	s := newSubscriber(log.NewNopLogger(), newSubscriberMetrics(), newTestConfig(srv, cfg))
	t.Cleanup(s.close)
	return s
}

func newTestServer(t *testing.T, nats setting.NATSSettings) (*Server, *Config) {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.NATS = nats
	// sqlStore is not touched here, so nil is acceptable.
	s, err := ProvideServer(cfg, nil, prometheus.NewRegistry())
	require.NoError(t, err)
	ep := ProvideNATSConfig(cfg, s)
	return s, ep
}

func startService(t *testing.T, ctx context.Context, svc services.Service) {
	t.Helper()
	require.NoError(t, svc.StartAsync(ctx))
	require.NoError(t, svc.AwaitRunning(ctx))
	t.Cleanup(func() {
		svc.StopAsync()
		_ = svc.AwaitTerminated(context.Background())
	})
}

func freePort(t *testing.T) int {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	port := l.Addr().(*net.TCPAddr).Port
	require.NoError(t, l.Close())
	return port
}
