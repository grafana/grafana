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
	serviceName             = "nats"
)

var ErrDisabled = errors.New("nats is disabled")

// Service owns the NATS platform lifecycle: the optional embedded server. It is
// a dskit service (so it composes with the module server) that also bridges to
// the monolith background-service contract via Run. It is a no-op when NATS is
// disabled.
type Service struct {
	services.NamedService

	cfg     setting.NATSSettings
	log     log.Logger
	metrics *metrics

	mu         sync.RWMutex
	server     *natsserver.Server
	opts       *natsserver.Options
	clientURLs []string
}

func ProvideService(cfg *setting.Cfg, _ *sqlstore.SQLStore, reg prometheus.Registerer) (*Service, error) {
	logger := log.New("infra.nats")
	m := newMetrics(reg)

	s := &Service{
		cfg:        cfg.NATS,
		log:        logger,
		metrics:    m,
		clientURLs: append([]string(nil), cfg.NATS.ClientURLs...),
	}

	s.opts = s.serverOptions()
	s.NamedService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(serviceName)

	return s, nil
}

func (s *Service) IsDisabled() bool {
	return !s.cfg.Enabled
}

// Run bridges the dskit service into the monolith background-service contract.
func (s *Service) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(ctx)
}

// starting runs once; ctx is the service context, live until the service stops.
func (s *Service) starting(ctx context.Context) error {
	if !s.cfg.Enabled {
		return nil
	}

	if s.cfg.Embedded() {
		if err := s.startEmbeddedServer(ctx); err != nil {
			return err
		}
	}

	if len(s.ClientURLs()) == 0 {
		return fmt.Errorf("nats is enabled but no client urls are available")
	}

	s.log.Info("nats platform started", "mode", s.cfg.Mode, "client_urls", s.ClientURLs())
	return nil
}

func (s *Service) running(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

func (s *Service) stopping(_ error) error {
	if !s.cfg.Enabled {
		return nil
	}
	s.shutdown(context.Background())
	return nil
}

// Health reports whether the platform is operational.
func (s *Service) Health(_ context.Context) error {
	if !s.cfg.Enabled {
		return ErrDisabled
	}
	if len(s.ClientURLs()) == 0 {
		return fmt.Errorf("nats has no client urls available")
	}
	if s.cfg.Embedded() {
		s.mu.RLock()
		server := s.server
		s.mu.RUnlock()
		if server == nil || !server.Running() {
			return fmt.Errorf("embedded nats server is not running")
		}
	}
	return nil
}

func (s *Service) ClientURLs() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]string(nil), s.clientURLs...)
}

func (s *Service) startEmbeddedServer(_ context.Context) error {
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
	s.clientURLs = append([]string{clientURL}, s.cfg.ClientURLs...)
	s.mu.Unlock()

	s.metrics.embeddedServerUp.Set(1)
	s.log.Info("started embedded nats server", "client_url", clientURL, "route_url", routeURL)

	return nil
}

func (s *Service) serverOptions() *natsserver.Options {
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

func (s *Service) shutdown(_ context.Context) {
	s.mu.RLock()
	server := s.server
	s.mu.RUnlock()

	if server != nil {
		server.Shutdown()
		server.WaitForShutdown()
		s.metrics.embeddedServerUp.Set(0)
	}
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
