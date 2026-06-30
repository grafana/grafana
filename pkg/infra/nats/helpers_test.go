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

// newTestEndpoints wires a shared endpoints provider to the in-process test
// server, mirroring how the Server publishes its local URL at runtime.
func newTestEndpoints(srv *natsserver.Server, cfg setting.NATSSettings) *endpoints {
	ep := newEndpoints(cfg)
	ep.setEmbedded(srv, cfg.ClientURLs)
	return ep
}

func newTestConnection(t *testing.T, srv *natsserver.Server) *connection {
	t.Helper()
	cfg := setting.NATSSettings{Enabled: true}
	c := newConnection(rolePublisher, cfg, log.NewNopLogger(), newMetrics(prometheus.NewRegistry()), newTestEndpoints(srv, cfg), func() string { return "" })
	t.Cleanup(c.close)
	return c
}

func newTestPublisher(t *testing.T, srv *natsserver.Server) *PublisherService {
	t.Helper()
	cfg := setting.NATSSettings{Enabled: true}
	p := newPublisher(cfg, log.NewNopLogger(), newMetrics(prometheus.NewRegistry()), newTestEndpoints(srv, cfg))
	t.Cleanup(p.close)
	return p
}

func newTestServer(t *testing.T, nats setting.NATSSettings) (*Server, *endpoints) {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.NATS = nats
	ep := ProvideEndpoints(cfg)
	// sqlStore is not touched here, so nil is acceptable.
	s, err := ProvideServer(cfg, nil, ep, newMetrics(prometheus.NewRegistry()))
	require.NoError(t, err)
	return s, ep
}
