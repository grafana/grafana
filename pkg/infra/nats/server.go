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

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/dskit/services"
	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const (
	defaultServerNamePrefix = "grafana-nats-"
	ServerServiceName       = "nats-server"

	routePingInterval = 5 * time.Second
	routeMaxPingsOut  = 2

	routeCredentialAttemptTimeout = 10 * time.Second
)

// routeCredentialBackoff paces the background retry for the route credential
// until it loads or the server stops. Tests that wait on it shorten it.
var routeCredentialBackoff = backoff.Config{MinBackoff: 5 * time.Second, MaxBackoff: 30 * time.Second}

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
	creds   routeCredentialStore

	mu        sync.RWMutex
	server    *natsserver.Server
	opts      *natsserver.Options
	discovery *discovery

	// reloadMu serialises ReloadOptions calls; see reload.
	reloadMu sync.Mutex
	// clusterTLS is nil unless cluster TLS is configured.
	clusterTLS *clusterTLSWatcher
	// routeAuth is the route credential from Secrets Manager. It is nil
	// without discovery on a shared store, and until the credential loads when
	// it could not be read or created at startup. Guarded by mu.
	routeAuth *url.Userinfo
	// routePlaceholder is the cluster credential while routeAuth is still
	// loading: a random per-process password no peer knows, so the cluster port
	// rejects every route without leaving the address it will serve on.
	routePlaceholder *url.Userinfo
	// routeAuthUndecryptable is set while the last attempt to load the route
	// credential found one that cannot be decrypted, which has been warned about.
	routeAuthUndecryptable bool
	// routeSecrets are masked in embedded server logs.
	routeSecrets *routeSecrets
}

// ProvideServer takes secretsMigrated so the route credential is only read or
// created once the Secrets Manager tables exist.
func ProvideServer(cfg *setting.Cfg, sqlStore db.DB, encryption contracts.EncryptionManager, encryptedValues contracts.EncryptedValueStorage, secretsMigrated *contracts.SecretDBMigrated, reg prometheus.Registerer) (*Server, error) {
	// Peers only find each other through discovery on the database, so without a
	// sqlStore (module mode) the embedded server runs as a standalone node.
	// A SQLite file isn't shared between hosts, so it is standalone too unless
	// listen_address opts it in; a standalone node opens no cluster port that a
	// second instance on the host could collide with.
	var store kv.KV
	if cfg.NATS.Enabled && cfg.NATS.Embedded() && cfg.NATS.DiscoveryEnabled && sqlStore != nil &&
		(sharedDatabase(dbDriver(sqlStore)) || cfg.NATS.ListenAddress != "") {
		sqlKV, err := kv.NewSQLKV(sqlStore.GetEngine().DB().DB, sqlStore.GetDialect().DriverName())
		if err != nil {
			return nil, fmt.Errorf("create nats discovery kv: %w", err)
		}
		store = sqlKV
		if encryption == nil || encryptedValues == nil || secretsMigrated == nil {
			return nil, errors.New("nats peer discovery needs Secrets Manager to store the route credential")
		}
	}
	creds := routeCredentialStore{
		encryption: encryption,
		values:     encryptedValues,
		namespace:  xkube.Namespace(request.GetNamespaceMapper(cfg)(1)),
	}
	return newServer(cfg.NATS, store, creds, dbDriver(sqlStore), log.New("infra.nats.server"), reg)
}

// newServer builds the server around store, the shared peer registry, which
// is nil for a standalone node. creds keeps the route credential. dbDriver
// names the database behind store.
func newServer(cfg setting.NATSSettings, store kv.KV, creds routeCredentialStore, dbDriver string, logger log.Logger, reg prometheus.Registerer) (*Server, error) {
	s := &Server{
		cfg:   cfg,
		log:   logger,
		kv:    store,
		creds: creds,
	}

	// Only register the embedded-server metrics when this instance actually runs
	// the embedded server; external/Cloud mode owns nothing here.
	if !s.IsDisabled() {
		s.metrics = newServerMetrics(reg, s.routedPeers)

		s.routeSecrets = &routeSecrets{}
		if s.clusters() {
			s.configureClustering(dbDriver)
		}
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
			if !s.clusters() {
				s.log.Warn("nats cluster_tls_* settings are ignored: this instance does not cluster, so it opens no cluster port. " +
					"Clustering needs discovery_enabled and a MySQL or Postgres database, or listen_address set")
			} else if err := s.configureClusterTLS(reg); err != nil {
				return nil, err
			}
		}
	}
	s.NamedService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(ServerServiceName)

	return s, nil
}

// configureClustering resolves the route credential and the cluster listen and
// advertise addresses. Every route authenticates, with the real credential or,
// until it loads, the placeholder.
func (s *Server) configureClustering(dbDriver string) {
	creds, err := s.loadRouteAuth(context.Background())
	if err != nil {
		s.warnRouteAuthWait(err)
		s.routeAuthUndecryptable = errors.Is(err, errRouteCredentialUndecryptable)
		s.routePlaceholder = url.UserPassword(routeAuthUser, randomRoutePassword())
		s.routeSecrets.add(s.routePlaceholder)
	} else {
		s.routeAuth = creds
		s.routeSecrets.add(creds)
	}
	if s.cfg.ListenAddress == "" {
		s.cfg.ListenAddress = autoListenAddress(s.log, dbDriver)
	}
	warnExposedClusterPort(s.log, s.cfg)

	// The resolved host feeds both Cluster.Advertise and the registry route URL,
	// so gossip and discovery hand peers the same address.
	host, detected := resolveAdvertiseHost(s.cfg, upInterfaceIPs)
	if detected {
		s.log.Info("detected nats cluster advertise address", "address", host)
	}
	s.cfg.AdvertiseAddress = host
}

// clusters reports whether this server can have peers, which it only learns
// through discovery on a shared registry. Otherwise it opens no cluster port.
func (s *Server) clusters() bool {
	return s.kv != nil && s.cfg.DiscoveryEnabled
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

// routedPeers counts the remote servers with at least one established route.
// NumRoutes would count each connection of a route pool.
func (s *Server) routedPeers() int {
	s.mu.RLock()
	server := s.server
	s.mu.RUnlock()
	if server == nil || !server.Running() {
		return 0
	}
	return server.NumRemotes()
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
	if s.routePlaceholder != nil {
		// Clustering waits for the route credential; peers only learn about this
		// instance once discovery starts with it.
		creds := s.awaitRouteAuth(ctx)
		if creds == nil {
			return nil
		}
		var err error
		if d, err = s.enableClustering(creds); err != nil {
			s.log.Error("failed to apply the nats route credential; clustering stays disabled until restart", "err", err)
			<-ctx.Done()
			return nil
		}
	}
	if d == nil {
		<-ctx.Done()
		return nil
	}
	return d.run(ctx)
}

// awaitRouteAuth retries the route credential until it loads, or returns nil
// once ctx is done.
func (s *Server) awaitRouteAuth(ctx context.Context) *url.Userinfo {
	b := backoff.New(ctx, routeCredentialBackoff)
	for b.Ongoing() {
		b.Wait()
		if ctx.Err() != nil {
			return nil
		}
		creds, err := s.loadRouteAuth(ctx)
		if err == nil {
			return creds
		}
		undecryptable := errors.Is(err, errRouteCredentialUndecryptable)
		if undecryptable && !s.routeAuthUndecryptable {
			// It usually takes an operator to fix, so it is worth a warning, once.
			s.warnRouteAuthWait(err)
		} else {
			s.log.Debug("failed to read or create the nats route credential; retrying", "err", err, "attempt", b.NumRetries())
		}
		s.routeAuthUndecryptable = undecryptable
	}
	return nil
}

// warnRouteAuthWait explains why clustering waits for the route credential.
func (s *Server) warnRouteAuthWait(err error) {
	if errors.Is(err, errRouteCredentialUndecryptable) {
		s.log.Warn("nats cluster routes wait for the route credential, but the stored credential cannot be decrypted. "+
			"If this persists, check that every instance uses the same [secrets_manager] encryption provider and keys. "+
			"Only once they do and Secrets Manager can encrypt new secrets on every instance, delete the row and restart every instance, "+
			"and the first to start creates a new credential", "table", "secret_encrypted_value", "namespace", s.creds.namespace, "name", routeCredentialName(discoveryClusterName),
			"version", routeCredentialVersion, "err", err)
		return
	}
	s.log.Warn("nats cluster routes wait for the route credential; clustering starts once it can be read or created", "err", err)
}

// enableClustering replaces the placeholder with the route credential and
// starts discovery. nats-server checks accepted routes against its current
// options, so new routes authenticate without a restart.
func (s *Server) enableClustering(creds *url.Userinfo) (*discovery, error) {
	s.routeSecrets.add(creds)
	password, _ := creds.Password()
	if err := s.reload(func(o *natsserver.Options) {
		o.Cluster.Username = creds.Username()
		o.Cluster.Password = password
	}); err != nil {
		return nil, err
	}

	s.mu.Lock()
	s.routeAuth = creds
	s.discovery = s.newPeerDiscovery(s.server, s.opts)
	d := s.discovery
	s.mu.Unlock()
	s.log.Info("nats clustering enabled: the route credential is loaded")
	return d, nil
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
		d.close()
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
	server.SetLoggerV2(newServerLogger(s.log, s.routeSecrets), false, false, false)
	server.Start()
	if !server.ReadyForConnections(10 * time.Second) {
		server.Shutdown()
		return fmt.Errorf("embedded nats server did not become ready")
	}

	clientURL := server.ClientURL()

	s.mu.Lock()
	s.server = server
	s.opts = &opts
	// Without the route credential yet, running starts discovery once it loads.
	if s.clusters() && s.routeAuth != nil {
		s.discovery = s.newPeerDiscovery(server, &opts)
	}
	s.mu.Unlock()

	s.metrics.embeddedServerUp.Set(1)
	var routeURL string
	if s.clusters() {
		routeURL = routeURLForServer(s.cfg, server)
		s.log.Info("started embedded nats server", "client_url", clientURL, "client_listen", s.cfg.ClientListen,
			"route_url", routeURL, "cluster_tls", s.cfg.ClusterTLS.Enabled(), "route_auth", opts.Cluster.Username != "")
	} else {
		s.log.Info("started embedded nats server without clustering, so the cluster port is not opened. "+
			"Clustering needs discovery_enabled and a MySQL or Postgres database, or listen_address set",
			"client_url", clientURL, "client_listen", s.cfg.ClientListen, "discovery_enabled", s.cfg.DiscoveryEnabled)
	}
	if s.cfg.ClientListen {
		s.log.Warn("nats client port is open without TLS or authentication; anyone who can reach it can publish and subscribe on every subject",
			"client_url", clientURL)
	}
	if s.cfg.TLS.Enabled {
		s.log.Warn("nats tls_* settings only apply to external NATS servers and are ignored in embedded mode; use cluster_tls_* to secure routes between instances")
	}

	// Discovery advertises route_url to peers via the shared DB. A loopback route
	// resolves to the advertising node itself, so peers on other hosts can never
	// dial it and clustering silently no-ops. Warn rather than fail: a loopback
	// listen_address is a legitimate choice for instances on one host.
	if s.clusters() && isLoopbackRouteURL(routeURL) {
		s.log.Warn("embedded nats advertising a loopback route url; multi-host clustering will not form. "+
			"Set listen_address to a routable address, or bind 0.0.0.0 and set advertise_address to a routable address",
			"route_url", routeURL)
	}

	return nil
}

func (s *Server) newPeerDiscovery(server *natsserver.Server, opts *natsserver.Options) *discovery {
	return newDiscovery(
		s.log,
		server,
		newKVPeerStore(s.kv, opts.Cluster.Name),
		peer{ServerName: opts.ServerName, RouteURL: routeURLForServer(s.cfg, server)},
		discoveryOptions{
			reload:   s.setRoutes,
			interval: s.cfg.DiscoveryInterval,
			ttl:      s.cfg.DiscoveryTTL,
			metrics:  s.metrics,
		},
	)
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
	opts := &natsserver.Options{
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
	}
	if !s.clusters() {
		// A zero cluster port opens no route listener.
		return opts
	}
	opts.Cluster = natsserver.ClusterOpts{
		Name:      discoveryClusterName,
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
	}
	if auth := cmp.Or(s.routeAuth, s.routePlaceholder); auth != nil {
		// The server checks these on accepted routes and presents them when it
		// dials a peer it learned through gossip.
		opts.Cluster.Username = auth.Username()
		opts.Cluster.Password, _ = auth.Password()
	}
	return opts
}

// loadRouteAuth makes one bounded attempt to read or create the route
// credential in Secrets Manager.
func (s *Server) loadRouteAuth(ctx context.Context) (*url.Userinfo, error) {
	ctx, cancel := context.WithTimeout(ctx, routeCredentialAttemptTimeout)
	defer cancel()
	return loadRouteCredentials(ctx, s.creds, discoveryClusterName)
}

func dbDriver(sqlStore db.DB) string {
	if sqlStore == nil {
		return ""
	}
	return sqlStore.GetDialect().DriverName()
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
