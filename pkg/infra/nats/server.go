package nats

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/url"
	"sync"
	"time"

	"github.com/grafana/dskit/services"
	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	defaultServerNamePrefix = "grafana-nats-"
	serverName              = "nats-server"
)

var (
	ErrDisabled = errors.New("nats is disabled")
	ErrClosed   = errors.New("nats connection is closed")
)

// Server owns the embedded NATS server lifecycle, which is an On-Prem concern
// only: in external/Cloud mode it is a no-op and need not be wired at all. Once
// the embedded server is ready it publishes its local URL and in-process dial
// option to the shared endpoints, which is how publisher/consumer clients reach
// it. It is a dskit service that bridges to the monolith background-service
// contract via Run.
type Server struct {
	services.NamedService

	cfg       setting.NATSSettings
	log       log.Logger
	metrics   *metrics
	endpoints *endpoints

	mu     sync.RWMutex
	server *natsserver.Server
	opts   *natsserver.Options
}

func ProvideServer(cfg *setting.Cfg, _ *sqlstore.SQLStore, ep *endpoints, m *metrics) (*Server, error) {
	s := &Server{
		cfg:       cfg.NATS,
		log:       log.New("infra.nats.server"),
		metrics:   m,
		endpoints: ep,
	}

	s.opts = s.serverOptions()
	s.NamedService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(serverName)

	return s, nil
}

// IsDisabled reports whether the embedded server should run. It is disabled when
// NATS is off entirely or running against an external broker.
func (s *Server) IsDisabled() bool {
	return !s.cfg.Enabled || !s.cfg.Embedded()
}

// Run bridges the dskit service into the monolith background-service contract.
func (s *Server) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(ctx)
}

func (s *Server) starting(ctx context.Context) error {
	if s.IsDisabled() {
		return nil
	}

	if err := s.startEmbeddedServer(ctx); err != nil {
		return err
	}

	if len(s.endpoints.URLs()) == 0 {
		return fmt.Errorf("nats embedded server started but no client urls are available")
	}

	s.log.Info("embedded nats server started", "client_urls", s.endpoints.URLs())
	return nil
}

func (s *Server) running(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

func (s *Server) stopping(_ error) error {
	if s.IsDisabled() {
		return nil
	}
	s.shutdown()
	return nil
}

func (s *Server) Health(_ context.Context) error {
	if !s.cfg.Enabled {
		return ErrDisabled
	}
	if !s.cfg.Embedded() {
		// Nothing to own in external mode; the client connections report health.
		return nil
	}
	s.mu.RLock()
	server := s.server
	s.mu.RUnlock()
	if server == nil || !server.Running() {
		return fmt.Errorf("embedded nats server is not running")
	}
	return nil
}

func (s *Server) startEmbeddedServer(_ context.Context) error {
	opts := *s.opts

	server, err := natsserver.NewServer(&opts)
	if err != nil {
		return fmt.Errorf("create embedded nats server: %w", err)
	}
	server.Start()
	if !server.ReadyForConnections(10 * time.Second) {
		server.Shutdown()
		return fmt.Errorf("embedded nats server did not become ready")
	}

	clientURL := server.ClientURL()
	routeURL := routeURLForServer(s.cfg, server)

	s.mu.Lock()
	s.server = server
	s.opts = &opts
	s.mu.Unlock()

	// Publish the local endpoint so clients connect in-process; peers still
	// cluster over TCP routes.
	s.endpoints.setEmbedded(server, s.cfg.ClientURLs)

	s.metrics.embeddedServerUp.Set(1)
	s.log.Info("started embedded nats server", "client_url", clientURL, "route_url", routeURL)

	return nil
}

func (s *Server) serverOptions() *natsserver.Options {
	return &natsserver.Options{
		ServerName:            defaultServerNamePrefix + randomSuffix(),
		Host:                  s.cfg.ListenAddress,
		Port:                  s.cfg.ClientPort,
		NoLog:                 true,
		NoSigs:                true,
		JetStream:             false,
		NoSystemAccount:       true,
		Cluster:               natsserver.ClusterOpts{Name: "grafana", Host: s.cfg.ListenAddress, Port: s.cfg.ClusterPort},
		ConnectErrorReports:   1,
		ReconnectErrorReports: 1,
	}
}

func (s *Server) shutdown() {
	s.mu.RLock()
	server := s.server
	s.mu.RUnlock()

	if server != nil {
		server.Shutdown()
		server.WaitForShutdown()
		s.metrics.embeddedServerUp.Set(0)
	}
}

// ProvideMetrics registers the NATS metrics once so the Server and the client
// components can share a single registration.
func ProvideMetrics(reg prometheus.Registerer) *metrics {
	return newMetrics(reg)
}

func randomSuffix() string {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

func routeURLForServer(cfg setting.NATSSettings, server *natsserver.Server) string {
	addr := server.ClusterAddr()
	host := cfg.AdvertiseAddress
	if host == "" {
		host = cfg.ListenAddress
	}
	if parsedHost, _, err := net.SplitHostPort(host); err == nil {
		host = parsedHost
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}
	u := url.URL{Scheme: "nats", Host: net.JoinHostPort(host, fmt.Sprintf("%d", addr.Port))}
	return u.String()
}
