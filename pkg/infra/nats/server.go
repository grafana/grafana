package nats

import (
	"cmp"
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
	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const (
	defaultServerNamePrefix = "grafana-nats-"
	ServerServiceName       = "nats-server"

	routePingInterval = 5 * time.Second
	routeMaxPingsOut  = 2
)

var (
	ErrDisabled = errors.New("nats is disabled")
	ErrClosed   = errors.New("nats connection is closed")
)

// Server owns the embedded NATS server lifecycle (On-Prem only; no-op in external/Cloud mode).
type Server struct {
	services.NamedService

	cfg     setting.NATSSettings
	log     log.Logger
	metrics *serverMetrics
	kv      kv.KV

	mu        sync.RWMutex
	server    *natsserver.Server
	opts      *natsserver.Options
	discovery *discovery

	// reloadMu serialises ReloadOptions calls; see reload.
	reloadMu sync.Mutex
	// clusterTLS is nil unless cluster TLS is configured.
	clusterTLS *clusterTLSWatcher
}

func ProvideServer(cfg *setting.Cfg, sqlStore db.DB, reg prometheus.Registerer) (*Server, error) {
	s := &Server{
		cfg: cfg.NATS,
		log: log.New("infra.nats.server"),
	}

	// A sqlStore is required to wire DB-backed peer discovery. When present (the
	// monolith always injects it) the embedded server clusters through discovery;
	// when absent it runs as a single standalone node. Module mode passes nil but
	// is prevented from enabling embedded NATS upstream (see module_server.go), so
	// in practice a running embedded server in production always has discovery.
	if !s.IsDisabled() && sqlStore != nil {
		sqlKV, err := kv.NewSQLKV(sqlStore.GetEngine().DB().DB, sqlStore.GetDialect().DriverName())
		if err != nil {
			return nil, fmt.Errorf("create nats discovery kv: %w", err)
		}
		s.kv = sqlKV
	}

	// Only register the embedded-server metrics when this instance actually runs
	// the embedded server; external/Cloud mode owns nothing here.
	if !s.IsDisabled() {
		s.metrics = newServerMetrics(reg)

		// The resolved host feeds both Cluster.Advertise and the registry route URL,
		// so gossip and discovery hand peers the same address.
		host, detected := resolveAdvertiseHost(s.cfg, upInterfaceIPs)
		if detected {
			s.log.Info("detected nats cluster advertise address", "address", host)
		}
		s.cfg.AdvertiseAddress = host
	}

	s.opts = s.serverOptions()
	if !s.IsDisabled() {
		if s.cfg.ClientListen {
			// The client port has no TLS or auth, so it never follows listen_address.
			s.opts.Host = cmp.Or(s.cfg.ClientListenAddress, "127.0.0.1")
		} else {
			restrictToInProcessClients(s.opts)
		}
		if s.cfg.ClusterTLS.Enabled() {
			if err := s.configureClusterTLS(reg); err != nil {
				return nil, err
			}
		}
	}
	s.NamedService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(ServerServiceName)

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

	return s.startEmbeddedServer(ctx)
}

func (s *Server) clientURL() string {
	if s == nil {
		return ""
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.server == nil {
		return ""
	}
	return s.server.ClientURL()
}

func (s *Server) dialOptions() []natsclient.Option {
	if s == nil {
		return nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.server == nil {
		return nil
	}
	return []natsclient.Option{natsclient.InProcessServer(s.server)}
}

func (s *Server) running(ctx context.Context) error {
	if s.clusterTLS != nil {
		var wg sync.WaitGroup
		wg.Go(func() { s.clusterTLS.run(ctx) })
		// Stop reloading before stopping shuts the server down.
		defer wg.Wait()
	}

	s.mu.RLock()
	d := s.discovery
	s.mu.RUnlock()
	if d == nil {
		<-ctx.Done()
		return nil
	}
	return d.run(ctx)
}

func (s *Server) stopping(_ error) error {
	if s.IsDisabled() {
		return nil
	}
	s.mu.RLock()
	d := s.discovery
	s.mu.RUnlock()
	if d != nil {
		// running's ctx is already cancelled by now, so deregister on a fresh
		// bounded context. Best-effort: the TTL prune is the backstop.
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		d.deregister(ctx)
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
	server.SetLoggerV2(serverLogger{log: s.log}, false, false, false)
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
	// Wire peer discovery only when enabled and a KV is available. The monolith always
	// injects a sqlStore, so production embedded servers cluster through discovery; module
	// mode cannot enable embedded NATS (see module_server.go). A nil KV therefore only
	// happens for a single standalone node (e.g. tests), which runs without clustering.
	if s.cfg.DiscoveryEnabled && s.kv != nil {
		s.discovery = newDiscovery(
			s.log,
			server,
			newKVPeerStore(s.kv, opts.Cluster.Name),
			peer{ServerName: opts.ServerName, RouteURL: routeURL},
			discoveryOptions{
				reload:   s.setRoutes,
				interval: s.cfg.DiscoveryInterval,
				ttl:      s.cfg.DiscoveryTTL,
			},
		)
	}
	s.mu.Unlock()

	s.metrics.embeddedServerUp.Set(1)
	s.log.Info("started embedded nats server", "client_url", clientURL, "client_listen", s.cfg.ClientListen,
		"route_url", routeURL, "cluster_tls", s.cfg.ClusterTLS.Enabled())
	if s.cfg.ClientListen {
		s.log.Warn("nats client port is open without TLS or authentication; anyone who can reach it can publish and subscribe on every subject",
			"client_url", clientURL)
	}
	if s.cfg.TLS.Enabled {
		s.log.Warn("nats tls_* settings only apply to external NATS servers and are ignored in embedded mode; use cluster_tls_* to secure routes between instances")
	}

	// Discovery advertises route_url to peers via the shared DB. A loopback route
	// resolves to the advertising node itself, so peers on other hosts can never
	// dial it and clustering silently no-ops. Warn rather than fail: a single
	// standalone node on default config is a legitimate case.
	if s.cfg.DiscoveryEnabled && s.kv != nil && isLoopbackRouteURL(routeURL) {
		s.log.Warn("embedded nats advertising a loopback route url; multi-host clustering will not form. "+
			"Set listen_address to a routable address, or bind 0.0.0.0 and set advertise_address to a routable address",
			"route_url", routeURL)
	}

	return nil
}

// isLoopbackRouteURL reports whether the route URL's host is a loopback address,
// which only clusters within a single host.
func isLoopbackRouteURL(routeURL string) bool {
	u, err := url.Parse(routeURL)
	if err != nil {
		return false
	}
	ip := net.ParseIP(u.Hostname())
	return ip != nil && ip.IsLoopback()
}

func (s *Server) serverOptions() *natsserver.Options {
	return &natsserver.Options{
		ServerName:      defaultServerNamePrefix + randomSuffix(),
		Host:            s.cfg.ListenAddress,
		Port:            s.cfg.ClientPort,
		NoSigs:          true,
		JetStream:       false,
		NoSystemAccount: true,
		// Report the first failed route dial, then every 5th, so a dead peer that
		// stays routed until the discovery TTL does not log an error per second.
		ConnectErrorReports:   5,
		ReconnectErrorReports: 5,
		Cluster: natsserver.ClusterOpts{
			Name:      "grafana",
			Host:      s.cfg.ListenAddress,
			Port:      s.cfg.ClusterPort,
			Advertise: clusterAdvertise(s.cfg.AdvertiseAddress),
			// Clients connect in-process, so peers' client URLs would only fill
			// their server pools with addresses they never dial.
			NoAdvertise: true,
			// A half-dead route drops messages without telling any client, until
			// the server closes it as stale. The defaults (30s pings, 2 missed)
			// take 60-90s to notice; these take 10-15s.
			PingInterval: routePingInterval,
			MaxPingsOut:  routeMaxPingsOut,
		},
	}
}

func (s *Server) configureClusterTLS(reg prometheus.Registerer) error {
	tc, fingerprint, err := loadClusterTLS(s.cfg.ClusterTLS)
	if err != nil {
		return err
	}
	metrics := newClusterTLSMetrics(reg)
	metrics.recordReloadSuccess(time.Now())
	s.opts.Cluster.TLSConfig = tc
	s.clusterTLS = &clusterTLSWatcher{
		log:      s.log,
		metrics:  metrics,
		cfg:      s.cfg.ClusterTLS,
		interval: clusterTLSReloadInterval,
		apply:    s.setClusterTLS,
		last:     fingerprint,
	}
	return nil
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
	scheme := "nats"
	if cfg.ClusterTLS.Enabled() {
		scheme = "tls"
	}
	u := url.URL{Scheme: scheme, Host: net.JoinHostPort(host, fmt.Sprintf("%d", addr.Port))}
	return u.String()
}
