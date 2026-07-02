package resource

import (
	"context"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// SearchEngineHooks wires an engine-agnostic implementation into searchServer
// without creating an import cycle between resource and search/engine.
type SearchEngineHooks struct {
	Index  func(ctx context.Context, key NamespacedResource, items []*BulkIndexItem, rv int64) error
	Search func(ctx context.Context, req *resourcepb.ResourceSearchRequest, stats *SearchStats) (*resourcepb.ResourceSearchResponse, error)
	// SkipLegacyIndex skips bleve getOrCreateIndex before engine Search when the
	// remote engine owns index freshness (e.g. Elasticsearch).
	SkipLegacyIndex bool
	// PushOnWrite indexes synchronously on the storage write path (remote engines).
	// When true, sleepAfterSuccessfulWriteOperation is skipped on the server.
	PushOnWrite bool
}

// EngineSetupConfig carries the searchServer state needed to wire an engine
// implementation without importing search/engine from the resource package.
type EngineSetupConfig struct {
	Backend            SearchBackend
	Access             authlib.AccessClient
	SearchFieldsHashes map[string]string
	GetFields          func(key NamespacedResource) SearchableDocumentFields
}

// EngineProviderSetup builds SearchEngineHooks once builder metadata is ready.
type EngineProviderSetup func(cfg EngineSetupConfig) (SearchEngineHooks, error)
