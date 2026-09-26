package nats

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	authnlib "github.com/grafana/authlib/authn"
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
	require.NoError(t, p.starting(context.Background()))
	return p
}

func newTestSubscriber(t *testing.T, srv *natsserver.Server) *SubscriberService {
	t.Helper()
	cfg := setting.NATSSettings{Enabled: true}
	s := newSubscriber(log.NewNopLogger(), newSubscriberMetrics(), newTestConfig(srv, cfg))
	t.Cleanup(s.close)
	require.NoError(t, s.starting(context.Background()))
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

func newTestClient(t *testing.T, role connRole, cfg *Config) (*connection, services.Service, func() error) {
	t.Helper()
	if role == rolePublisher {
		p := newPublisher(log.NewNopLogger(), newPublisherMetrics(), cfg)
		t.Cleanup(p.close)
		return p.connection, p, func() error { return p.Publish(t.Context(), "test", nil) }
	}
	s := newSubscriber(log.NewNopLogger(), newSubscriberMetrics(), cfg)
	t.Cleanup(s.close)
	return s.connection, s, func() error {
		sub, err := s.Subscribe(t.Context(), "test", func(string, []byte) {})
		if err != nil {
			return err
		}
		return sub.Unsubscribe()
	}
}

func startLifecycleServer(t *testing.T, port int, token string) *natsserver.Server {
	t.Helper()
	srv, err := natsserver.NewServer(&natsserver.Options{Host: "127.0.0.1", Port: port, NoLog: true, NoSigs: true, Authorization: token})
	require.NoError(t, err)
	go srv.Start()
	t.Cleanup(func() { srv.Shutdown(); srv.WaitForShutdown() })
	require.True(t, srv.ReadyForConnections(5*time.Second))
	return srv
}

func newTestBlockedClient(t *testing.T, url string) (*connection, services.Service, *blockingTokenExchanger, func()) {
	t.Helper()
	exchanger := &blockingTokenExchanger{entered: make(chan struct{}), release: make(chan struct{})}
	var once sync.Once
	unblock := func() { once.Do(func() { close(exchanger.release) }) }
	t.Cleanup(unblock)
	cfg := newConfig(setting.NATSSettings{
		Enabled: true, Mode: setting.NATSModeExternal, ClientURLs: []string{url},
		Auth: setting.NATSAuthSettings{Mode: setting.NATSAuthModeTokenExchange},
	}, nil)
	cfg.tokenExchanger = exchanger
	c, svc, _ := newTestClient(t, rolePublisher, cfg)
	return c, svc, exchanger, unblock
}

type blockingTokenExchanger struct {
	entered chan struct{}
	release chan struct{}
	calls   atomic.Int64
}

func (e *blockingTokenExchanger) Exchange(ctx context.Context, _ authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	if e.calls.Add(1) == 1 {
		close(e.entered)
	}
	select {
	case <-e.release:
		return &authnlib.TokenExchangeResponse{Token: "right-token"}, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}
