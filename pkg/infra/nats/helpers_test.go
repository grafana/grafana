package nats

import (
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

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
	p := newPublisher(log.NewNopLogger(), newPublisherMetrics(prometheus.NewRegistry()), newTestConfig(srv, cfg), func() string { return "" })
	t.Cleanup(p.close)
	return p
}

func newTestSubscriber(t *testing.T, srv *natsserver.Server) *SubscriberService {
	t.Helper()
	cfg := setting.NATSSettings{Enabled: true}
	s := newSubscriber(log.NewNopLogger(), newSubscriberMetrics(prometheus.NewRegistry()), newTestConfig(srv, cfg), func() string { return "" })
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
