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

	natsserver "github.com/nats-io/nats-server/v2/server"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const defaultServerNamePrefix = "grafana-nats-"

type Service struct {
	cfg setting.NATSSettings
	log log.Logger
	kv  kv.KV

	provider *clientProvider

	mu         sync.RWMutex
	server     *natsserver.Server
	opts       *natsserver.Options
	clientURLs []string
}

func ProvideService(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore) (*Service, error) {
	sqlKV, err := kv.NewSQLKV(sqlStore.GetEngine().DB().DB, sqlStore.GetDialect().DriverName())
	if err != nil {
		return nil, fmt.Errorf("create nats discovery kv: %w", err)
	}

	s := &Service{
		cfg:        cfg.NATS,
		log:        log.New("infra.nats"),
		kv:         sqlKV,
		clientURLs: append([]string(nil), cfg.NATS.ClientURLs...),
	}
	s.provider = &clientProvider{
		cfg:  cfg.NATS,
		urls: s.ClientURLs,
	}
	s.opts = s.serverOptions()

	return s, nil
}

func ProvideClientProvider(service *Service) ClientProvider {
	return service.provider
}

func (s *Service) IsDisabled() bool {
	return !s.cfg.Enabled
}

func (s *Service) Run(ctx context.Context) error {
	if !s.cfg.Enabled {
		<-ctx.Done()
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

	<-ctx.Done()
	s.shutdown(ctx)
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

	s.log.Info("started embedded nats server", "client_url", clientURL, "route_url", routeURL)

	if s.cfg.Discovery == "auto" {
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
	s.mu.RLock()
	server := s.server
	s.mu.RUnlock()

	if s.cfg.Discovery == "auto" {
		if err := s.unregister(ctx); err != nil {
			s.log.Warn("failed to unregister nats peer", "err", err)
		}
	}
	if server != nil {
		server.Shutdown()
		server.WaitForShutdown()
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
