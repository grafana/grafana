//go:build enterprise || pro

package server

import (
	"fmt"

	"github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/router"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/authz"
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
	return InitializeRoutesLoader(s.cfg, client, accessClient)
}

func (s *ModuleServer) routerStorageClient(accessClient types.AccessClient) (resource.ResourceClient, error) {
	apiserverCfg := s.cfg.SectionWithEnvOverrides("grafana-apiserver")
	storageType := options.StorageType(apiserverCfg.Key("storage_type").MustString(string(options.StorageTypeUnified)))
	if storageType == options.StorageTypeUnifiedGrpc {
		return unified.NewRemoteResourceClientFromConfig(s.cfg, s.features, s.tracer, s.registerer)
	}

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
