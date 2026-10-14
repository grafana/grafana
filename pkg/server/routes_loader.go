package server

import (
	"fmt"
	"net"
	"slices"

	"github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/router"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
)

func (s *ModuleServer) provideRoutesLoader() (router.RoutesLoader, error) {
	defaultRouterCoreURL(s.cfg, s.log)

	accessClient, err := authz.ProvideStandaloneAuthZClient(s.cfg, s.features, s.tracer, s.registerer)
	if err != nil {
		return nil, fmt.Errorf("creating router authorization client: %w", err)
	}

	client, err := s.routerStorageClient(accessClient)
	if err != nil {
		return nil, fmt.Errorf("creating router unified storage client: %w", err)
	}
	clients := router.RoutesLoaderClients{
		Resource:           client,
		RESTConfigProvider: router.NewLoopbackRestConfigProvider(s.httpServerRouter),
		Access:             accessClient,
	}

	// Only the local plugin loader needs the SQL database, which
	// InitializeRoutesLoader opens and migrates.
	if cloud, err := router.ProvideCloudRoutesLoader(s.cfg, clients, s.tracer, s.features, s.registerer); err != nil || cloud != nil {
		return cloud, err
	}
	return InitializeRoutesLoader(s.cfg, clients)
}

// defaultRouterCoreURL points core_url at cloud-core-apps-server on this process's
// own HTTP server when both run in the process and core_url isn't set.
func defaultRouterCoreURL(cfg *setting.Cfg, logger log.Logger) {
	if !slices.Contains(cfg.Target, modules.CloudCoreAppsServer) {
		return
	}
	// cloud-core-apps-server can serve only its operator, which leaves nothing at the path.
	if !cfg.SectionWithEnvOverrides("cloud_core_apps_server").Key("manifests").MustBool(true) {
		return
	}
	// The router's manifests client doesn't trust the instrumentation server's
	// certificate.
	if cfg.Protocol == setting.HTTPSScheme {
		logger.Warn("The router cannot default core_url to cloud-core-apps-server in this process over HTTPS. Set [cloud_router] core_url to serve its apps.")
		return
	}
	host := cfg.HTTPAddr
	if ip := net.ParseIP(host); host == "" || (ip != nil && ip.IsUnspecified()) {
		host = "127.0.0.1"
	}
	url := "http://" + net.JoinHostPort(host, cfg.HTTPPort) + modules.CloudCoreAppsServerPath
	if router.SetDefaultCoreURL(cfg, url) {
		logger.Info("The router has not been configured with core_url. Because cloud-core-apps-server runs in this process, the router is serving its apps from this process's HTTP server.", "core_url", url)
	}
}

func (s *ModuleServer) routerStorageClient(accessClient types.AccessClient) (resource.ResourceClient, error) {
	if !routerUsesLocalStorage(s.cfg) {
		return router.NewRemoteResourceClient(s.cfg, s.tracer, s.registerer)
	}

	// A local ResourceServer exposes the write APIs and initializes a write-event
	// watcher, so its backend must not have storage services disabled.
	resourceServer, err := sql.NewResourceServer(sql.ServerOptions{
		Backend:        s.storageBackend,
		WatchExpiry:    s.watchExpiry,
		VectorBackend:  s.vectorBackend,
		Embedder:       s.embedder,
		Reranker:       s.reranker,
		Cfg:            s.cfg,
		Tracer:         otel.Tracer("router"),
		Reg:            s.registerer,
		AccessClient:   accessClient,
		SearchClient:   s.searchClient,
		StorageMetrics: s.storageMetrics,
		IndexMetrics:   s.indexMetrics,
		VectorMetrics:  s.vectorMetrics,
		Features:       s.features,
	})
	if err != nil {
		return nil, err
	}
	return resource.NewLocalResourceClient(resourceServer), nil
}

func routerUsesLocalStorage(cfg *setting.Cfg) bool {
	apiserverCfg := cfg.SectionWithEnvOverrides("grafana-apiserver")
	storageType := options.StorageType(apiserverCfg.Key("storage_type").MustString(string(options.StorageTypeUnified)))
	return storageType != options.StorageTypeUnifiedGrpc
}

func routerNeedsWritableStorageBackend(cfg *setting.Cfg, routerEnabled bool) bool {
	return routerEnabled && routerUsesLocalStorage(cfg)
}
