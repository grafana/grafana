package nats

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/grafana/dskit/services"
	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const (
	defaultServerNamePrefix = "grafana-nats-"
	serviceName             = "nats"
)

// Service owns the NATS platform lifecycle: the optional embedded server,
// peer discovery, and the shared Bus. It is a dskit service (so it composes
// with the module server) that also bridges to the monolith background-service
// contract via Run. It is a no-op when NATS is disabled.
type Service struct {
	services.NamedService

	cfg     setting.NATSSettings
	log     log.Logger
	kv      kv.KV
	metrics *metrics

	bus *bus

	mu         sync.RWMutex
	server     *natsserver.Server
	opts       *natsserver.Options
	clientURLs []string
}

func ProvideService(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore, reg prometheus.Registerer) (*Service, error) {
	logger := log.New("infra.nats")
	m := newMetrics(reg)

	s := &Service{
		cfg:        cfg.NATS,
		log:        logger,
		metrics:    m,
		clientURLs: append([]string(nil), cfg.NATS.ClientURLs...),
	}

	// Discovery is only needed for the embedded clustered topology.
	if cfg.NATS.Enabled && cfg.NATS.Embedded && cfg.NATS.Discovery == "auto" {
		sqlKV, err := kv.NewSQLKV(sqlStore.GetEngine().DB().DB, sqlStore.GetDialect().DriverName())
		if err != nil {
			return nil, fmt.Errorf("create nats discovery kv: %w", err)
		}
		s.kv = sqlKV
	}

	s.bus = newBus(cfg.NATS, logger, m, s.ClientURLs)
	s.opts = s.serverOptions()
	s.NamedService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(serviceName)

	return s, nil
}

func ProvideBus(service *Service) Bus {
	return service.bus
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

	if s.cfg.Embedded {
		if err := s.startEmbeddedServer(ctx); err != nil {
			return err
		}
	}

	if len(s.ClientURLs()) == 0 {
		return fmt.Errorf("nats is enabled but no client urls are available")
	}

	s.log.Info("nats platform started", "embedded", s.cfg.Embedded, "client_urls", s.ClientURLs())
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
	if s.cfg.Embedded {
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

func (s *Service) startEmbeddedServer(ctx context.Context) error {
	opts := *s.opts
	routes, err := s.discoverRoutes(ctx, "")
	if err != nil {
		s.log.Warn("failed to discover initial nats routes", "err", err)
	} else {
		opts.Routes = routes
	}

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

	// Local hop connects in-process; peers still cluster over TCP routes.
	s.bus.setExtraOptions(natsclient.InProcessServer(server))

	s.metrics.embeddedServerUp.Set(1)
	s.log.Info("started embedded nats server", "client_url", clientURL, "route_url", routeURL)

	if s.cfg.Discovery == "auto" && s.kv != nil {
		go s.discoveryLoop(ctx, routeURL)
	}

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

func (s *Service) shutdown(ctx context.Context) {
	// Drain clients before the embedded server goes away.
	s.bus.close()

	s.mu.RLock()
	server := s.server
	s.mu.RUnlock()

	if s.cfg.Discovery == "auto" && s.kv != nil {
		if err := s.unregister(ctx); err != nil {
			s.log.Warn("failed to unregister nats peer", "err", err)
		}
	}
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

func parseRouteURLs(values []string) []*url.URL {
	routes := make([]*url.URL, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if u, err := url.Parse(value); err == nil {
			routes = append(routes, u)
		}
	}
	return routes
}
