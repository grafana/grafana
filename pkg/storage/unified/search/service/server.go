package service

import (
	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"

	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	searchmetrics "github.com/grafana/grafana/pkg/storage/unified/search/metrics"
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

type Options struct {
	Backend       resource.StorageReader
	Search        searchmodel.SearchOptions
	Blob          resourcecontract.BlobSupport
	Diagnostics   resourcepb.DiagnosticsServer
	AccessClient  types.AccessClient
	IndexMetrics  *searchmetrics.ServiceMetrics
	VectorMetrics *searchmetrics.VectorMetrics
	OwnsIndexFn   func(resourcecontract.NamespacedResource) (bool, error)
	VectorBackend vector.VectorBackend
	Embedder      *embedder.Embedder
	Reranker      *rerank.Reranker
}

// NewUninitializedSearchServer leaves startup to the composition owner.
func NewUninitializedSearchServer(opts Options) (searchmodel.SearchServer, error) {
	if opts.Backend == nil {
		return nil, fmt.Errorf("missing backend implementation")
	}
	if opts.Diagnostics == nil {
		opts.Diagnostics = &noopDiagnostics{}
	}
	if opts.Blob == nil {
		opts.Blob, _ = opts.Backend.(resourcecontract.BlobSupport)
	}
	server, err := newSearchServer(opts.Search, opts.Backend, opts.VectorBackend, opts.Embedder, opts.Reranker, opts.AccessClient, opts.Blob, opts.IndexMetrics, opts.VectorMetrics, opts.OwnsIndexFn)
	if err != nil || server == nil {
		return nil, fmt.Errorf("search server could not be created: %w", err)
	}
	server.backendDiagnostics = opts.Diagnostics
	return server, nil
}

func NewSearchServer(opts Options) (searchmodel.SearchServer, error) {
	server, err := NewUninitializedSearchServer(opts)
	if err != nil {
		return nil, err
	}
	if err := server.Init(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to initialize search server: %w", err)
	}
	return server, nil
}
