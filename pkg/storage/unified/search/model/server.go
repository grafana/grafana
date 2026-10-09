package model

import (
	"context"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// SearchServer implements the search-related gRPC services
type SearchServer interface {
	resourcepb.ResourceIndexServer
	resourcepb.ManagedObjectIndexServer
	// Deprecated: clients should use grpc.health.v1.Health with modules.SearchServer service name instead
	resourcepb.DiagnosticsServer //nolint:staticcheck
	Stop(ctx context.Context) error
	Init(ctx context.Context) error
}

// Passed as input to the constructor
type SearchOptions struct {
	// The raw index backend (eg, bleve, frames, parquet, etc)
	Backend SearchBackend

	// The supported resource types
	Resources DocumentBuilderSupplier

	// How many threads should build indexes
	InitWorkerThreads int

	// Skip building index on startup for small indexes
	InitMinCount int

	// How often to rebuild dashboard index. 0 disables periodic rebuilds.
	DashboardIndexMaxAge time.Duration

	// Maximum age of file-based index that can be reused. Ignored if zero.
	MaxIndexAge time.Duration

	// Minimum build version for reusing file-based indexes. Ignored if nil.
	MinBuildVersion *semver.Version

	// Running Grafana build version. Used to detect if index was built by a newer version.
	BuildVersion *semver.Version

	// Number of workers to use for index rebuilds.
	IndexRebuildWorkers int

	// Minimum time between index updates. This is also used as a delay after a successful write operation, to guarantee
	// that subsequent search will observe the effect of the writing.
	IndexMinUpdateInterval time.Duration

	// TTL for the dedup cache used in ListModifiedSince updates. 0 disables the cache.
	IndexModificationCacheTTL time.Duration

	// Percentage of search requests that should fail immediately (0-100). 0 = disabled, 100 = all requests fail.
	InjectFailuresPercent int

	// PostRankAuthzEnabled mirrors the index backend's post-rank authorization
	// setting. It selects the index features this server requires, so an index
	// that predates them is rebuilt before that path serves a query.
	PostRankAuthzEnabled bool

	// GlobalIndexEnabled builds one index per namespace covering several resource
	// types, alongside the per-resource indexes.
	GlobalIndexEnabled bool

	// SearchFields holds the per-kind search-field wiring shared with the index
	// backend. The search server reads the selectable fields and the definition
	// hash from it and triggers a rebuild when either differs from the values
	// stored in an index's IndexBuildInfo. May be nil.
	SearchFields *SearchFieldsRegistry

	// EmbeddingConfig is shared with the manifest watcher; consumers must read
	// it after the initial poll and retain the registry to observe later reloads.
	EmbeddingConfig *EmbeddingConfigRegistry

	// EmbeddingBuilders is evaluated after the initial manifest load and again
	// for queries, so a catalog row alone cannot enroll an internal collection.
	EmbeddingBuilders embed.BuilderProvider

	// Index snapshot settings — enable downloading pre-built search indexes from the storage KV on startup.
	// IndexSnapshotEnabled gates the entire snapshot feature.
	IndexSnapshotEnabled bool
	// IndexSnapshotThreshold is the minimum document count to use remote snapshots (must be >= IndexFileThreshold).
	IndexSnapshotThreshold int
	// IndexSnapshotMaxAge is the maximum age of a snapshot before it is deleted during cleanup.
	IndexSnapshotMaxAge time.Duration
	// IndexSnapshotMinDocChanges is the minimum number of document changes since the last
	// snapshot before a new upload is triggered.
	IndexSnapshotMinDocChanges int
	// IndexSnapshotUploadInterval is the minimum time between consecutive snapshot uploads.
	IndexSnapshotUploadInterval time.Duration
	// IndexSnapshotLockTTL is the TTL for the distributed lock used to coordinate uploads/cleanup.
	IndexSnapshotLockTTL time.Duration
	// IndexSnapshotCleanupInterval is how often snapshot cleanup runs.
	IndexSnapshotCleanupInterval time.Duration
	// IndexSnapshotCleanupGracePeriod is the time a newly uploaded snapshot must
	// have existed before its predecessor in the same Grafana-version group is
	// considered eligible for cleanup.
	IndexSnapshotCleanupGracePeriod time.Duration

	// VectorSearch query-embedding cache. nil disables the cache path.
	QueryCache             vector.QueryEmbeddingCache
	QueryCacheMaxPerTenant int

	// VectorSearch per-tenant rate limiter. nil disables rate limiting.
	RateLimiter        vector.RateLimiter
	RateLimitPerTenant int
	RateLimitWindow    time.Duration

	// Vector API collection allowlists: "group/resource" entries; empty allows nothing.
	AllowedInternalCollections []string
	AllowedExternalCollections []string
}
