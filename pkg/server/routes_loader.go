package server

import (
	"fmt"

	"github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/router"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
)

func (s *ModuleServer) provideRoutesLoader() (router.RoutesLoader, error) {
	accessClient, err := authz.ProvideStandaloneAuthZClient(s.cfg, s.features, s.tracer, s.registerer)
	if err != nil {
		return nil, fmt.Errorf("creating router authorization client: %w", err)
	}

	client, err := s.routerStorageClient(accessClient)
	if err != nil {
		return nil, fmt.Errorf("creating router unified storage client: %w", err)
	}
	return InitializeRoutesLoader(s.cfg, router.RoutesLoaderClients{
		Resource: client,
		Access:   accessClient,
	})
}

func (s *ModuleServer) routerStorageClient(accessClient types.AccessClient) (resource.ResourceClient, error) {
	if !routerUsesLocalStorage(s.cfg) {
		return unified.NewRemoteResourceClientFromConfig(s.cfg, s.features, s.tracer, s.registerer)
	}

	// A local ResourceServer exposes the write APIs and initializes a write-event
	// watcher, so its backend must not have storage services disabled.
	resourceServer, err := sql.NewResourceServer(sql.ServerOptions{
		Backend:        s.storageBackend,
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
