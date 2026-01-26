package resource

import (
	"context"
	"fmt"
	"iter"
	"time"

	"github.com/Masterminds/semver"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secrets "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/resource")

type SearchServer interface {
	LifecycleHooks

	resourcepb.ResourceIndexServer
	resourcepb.ManagedObjectIndexServer
	resourcepb.DiagnosticsServer
}

type StorageServer interface {
	resourcepb.ResourceStoreServer
	resourcepb.BulkStoreServer
	resourcepb.BlobStoreServer
	resourcepb.QuotasServer
	resourcepb.DiagnosticsServer
}

// ResourceServer implements all gRPC services
// Deprecated: use specific server instead (StorageServer / SearchServer)
type ResourceServer interface {
	resourcepb.ResourceStoreServer
	resourcepb.ResourceIndexServer
	resourcepb.ManagedObjectIndexServer
	resourcepb.BulkStoreServer
	resourcepb.BlobStoreServer
	resourcepb.DiagnosticsServer
	resourcepb.QuotasServer
	ResourceServerStopper
}

type ResourceServerStopper interface {
	Stop(ctx context.Context) error
}

type ListIterator interface {
	// Next advances iterator and returns true if there is next value is available from the iterator.
	// Error() should be checked after every call of Next(), even when Next() returns true.
	Next() bool // sql.Rows

	// Error returns iterator error, if any. This should be checked after any Next() call.
	// (Some iterator implementations return true from Next, but also set the error at the same time).
	Error() error

	// ContinueToken returns the token that can be used to start iterating *after* this item
	ContinueToken() string

	// ResourceVersion of the current item
	ResourceVersion() int64

	// Namespace of the current item
	// Used for fast(er) authz filtering
	Namespace() string

	// Name of the current item
	// Used for fast(er) authz filtering
	Name() string

	// Folder of the current item
	// Used for fast(er) authz filtering
	Folder() string

	// Value for the current item
	Value() []byte
}

type BackendReadResponse struct {
	// Metadata
	Key    *resourcepb.ResourceKey
	Folder string

	// GUID that is used internally
	GUID string
	// The new resource version
	ResourceVersion int64
	// The properties
	Value []byte
	// Error details
	Error *resourcepb.ErrorResult
}

type ResourceLastImportTime struct {
	NamespacedResource
	LastImportTime time.Time
}

// StorageWriter handles CRUD operations for writing resources
type StorageWriter interface {
	// Write a Create/Update/Delete,
	// NOTE: the contents of WriteEvent have been validated
	// Return the revisionVersion for this event or error
	WriteEvent(context.Context, WriteEvent) (int64, error)
}

// StorageReader handles read operations (used by both storage and search)
type StorageReader interface {
	// Read a resource from storage optionally at an explicit version
	ReadResource(context.Context, *resourcepb.ReadRequest) *BackendReadResponse

	// When the ResourceServer executes a List request, this iterator will
	// query the backend for potential results.  All results will be
	// checked against the kubernetes requirements before finally returning
	// results.  The list options can be used to improve performance
	// but are the the final answer.
	ListIterator(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error)

	// ListHistory is like ListIterator, but it returns the history of a resource
	ListHistory(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error)
}

// StorageWatcher handles watch/streaming operations
type StorageWatcher interface {
	// Get all events from the store
	// For HA setups, this will be more events than the local WriteEvent above!
	WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error)
}

// SearchSupport provides read operations for search indexing
type SearchSupport interface {
	// Get resource stats within the storage backend.  When namespace is empty, it will apply to all
	GetResourceStats(ctx context.Context, nsr NamespacedResource, minCount int) ([]ResourceStats, error)

	// GetResourceLastImportTimes returns import times for all namespaced resources in the backend.
	GetResourceLastImportTimes(ctx context.Context) iter.Seq2[ResourceLastImportTime, error]

	// ListModifiedSince will return all resources that have changed since the given resource version.
	// If a resource has changes, only the latest change will be returned.
	ListModifiedSince(ctx context.Context, key NamespacedResource, sinceRv int64) (int64, iter.Seq2[*ModifiedResource, error])
}

// The StorageBackend is an internal abstraction that supports interacting with
// the underlying raw storage medium.  This interface is never exposed directly,
// it is provided by concrete instances that actually write values.
// It combines all capabilities for backward compatibility.
type StorageBackend interface {
	StorageWriter
	StorageReader
	StorageWatcher
	SearchSupport
}

type ModifiedResource struct {
	Action          resourcepb.WatchEvent_Type
	Key             resourcepb.ResourceKey
	Value           []byte
	ResourceVersion int64
}

type ResourceStats struct {
	NamespacedResource

	Count           int64
	ResourceVersion int64
}

// This interface is not exposed to end users directly
// Access to this interface is already gated by access control
type BlobSupport interface {
	// Indicates if storage layer supports signed urls
	SupportsSignedURLs() bool

	// Get the raw blob bytes and metadata -- limited to protobuf message size
	// For larger payloads, we should use presigned URLs to upload from the client
	PutResourceBlob(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error)

	// Get blob contents.  When possible, this will return a signed URL
	// For large payloads, signed URLs are required to avoid protobuf message size limits
	GetResourceBlob(ctx context.Context, resource *resourcepb.ResourceKey, info *utils.BlobInfo, mustProxy bool) (*resourcepb.GetBlobResponse, error)

	// TODO? List+Delete?  This is for admin access
}

type QOSEnqueuer interface {
	Enqueue(ctx context.Context, tenantID string, runnable func()) error
}

type QueueConfig struct {
	MaxBackoff time.Duration
	MinBackoff time.Duration
	MaxRetries int
	Timeout    time.Duration
}

type BlobConfig struct {
	// The CDK configuration URL
	URL string

	// Directly implemented blob support
	Backend BlobSupport
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

	// Number of workers to use for index rebuilds.
	IndexRebuildWorkers int

	// Minimum time between index updates. This is also used as a delay after a successful write operation, to guarantee
	// that subsequent search will observe the effect of the writing.
	IndexMinUpdateInterval time.Duration
}

type ResourceServerOptions struct {
	// Real storage backend
	Backend StorageBackend

	// The blob configuration
	Blob BlobConfig

	// Search options
	// Deprecated: use NewSearchServer for search capabilities
	Search *SearchOptions

	// Function to determine if this server "owns" the index for a given resource
	// Deprecated: use NewSearchServer for search capabilities
	IndexMetrics *BleveIndexMetrics

	// Function to determine if this server "owns" the index for a given resource
	// Deprecated: use NewSearchServer for search capabilities
	OwnsIndexFn func(key NamespacedResource) (bool, error)

	// Quota service
	OverridesService *OverridesService

	// Diagnostics
	Diagnostics resourcepb.DiagnosticsServer

	// Check if a user has access to write folders
	// When this is nil, no resources can have folders configured
	WriteHooks WriteAccessHooks

	// Link RBAC
	AccessClient claims.AccessClient

	// Manage secure values
	SecureValues secrets.InlineSecureValueSupport

	// Callbacks for startup and shutdown
	Lifecycle LifecycleHooks

	// Get the current time in unix millis
	Now func() int64

	// Registerer to register prometheus Metrics for the Resource server
	Reg prometheus.Registerer

	StorageMetrics *StorageMetrics

	// MaxPageSizeBytes is the maximum size of a page in bytes.
	// Storage only.
	MaxPageSizeBytes int
	// IndexMinUpdateInterval is the time to wait after a successful write operation to ensure read-after-write consistency in search.
	// This config is shared with search
	IndexMinUpdateInterval time.Duration

	// QOSQueue is the quality of service queue used to enqueue
	QOSQueue  QOSEnqueuer
	QOSConfig QueueConfig
}

// NewResourceServer creates a new ResourceServer instance
// Deprecated: use NewStorageServer and NewSearchServer separately
func NewResourceServer(opts ResourceServerOptions) (*server, error) {
	if opts.Backend == nil {
		return nil, fmt.Errorf("missing Backend implementation")
	}

	// Create the storage server
	storageOpts := StorageServerOptions{
		Backend:                opts.Backend,
		Blob:                   opts.Blob,
		Diagnostics:            opts.Diagnostics,
		WriteHooks:             opts.WriteHooks,
		AccessClient:           opts.AccessClient,
		SecureValues:           opts.SecureValues,
		Lifecycle:              opts.Lifecycle,
		Now:                    opts.Now,
		Reg:                    opts.Reg,
		StorageMetrics:         opts.StorageMetrics,
		MaxPageSizeBytes:       opts.MaxPageSizeBytes,
		QOSQueue:               opts.QOSQueue,
		QOSConfig:              opts.QOSConfig,
		OverridesService:       opts.OverridesService,
		IndexMinUpdateInterval: opts.IndexMinUpdateInterval,
	}

	storage, err := NewStorageServer(storageOpts)
	if err != nil {
		return nil, err
	}

	storageImpl := storage.(*storageServer)

	s := &server{
		storage: storageImpl,
	}

	// Create search support if search options provided
	if opts.Search != nil {
		s.search, err = newSearchServer(*opts.Search, opts.Backend, storageImpl.access, storageImpl.blob, opts.IndexMetrics, opts.OwnsIndexFn)
		if err != nil {
			return nil, err
		}
		if err := s.search.init(context.Background()); err != nil {
			return nil, fmt.Errorf("failed to initialize search: %w", err)
		}
	}

	return s, nil
}

var _ ResourceServer = &server{}

// server composes storage and search for unified mode
// Deprecated: use NewStorageServer/NewSearchServer separately
type server struct {
	storage *storageServer
	search  *searchServer
}

// Stop implements ResourceServer.
func (s *server) Stop(ctx context.Context) error {
	// Stop search first
	if s.search != nil {
		s.search.stop()
	}

	// Then stop storage
	return s.storage.Stop(ctx)
}

// ResourceStoreServer - delegate to storage

func (s *server) Create(ctx context.Context, req *resourcepb.CreateRequest) (*resourcepb.CreateResponse, error) {
	return s.storage.Create(ctx, req)
}

func (s *server) Update(ctx context.Context, req *resourcepb.UpdateRequest) (*resourcepb.UpdateResponse, error) {
	return s.storage.Update(ctx, req)
}

func (s *server) Delete(ctx context.Context, req *resourcepb.DeleteRequest) (*resourcepb.DeleteResponse, error) {
	return s.storage.Delete(ctx, req)
}

func (s *server) Read(ctx context.Context, req *resourcepb.ReadRequest) (*resourcepb.ReadResponse, error) {
	return s.storage.Read(ctx, req)
}

func (s *server) List(ctx context.Context, req *resourcepb.ListRequest) (*resourcepb.ListResponse, error) {
	return s.storage.List(ctx, req)
}

func (s *server) Watch(req *resourcepb.WatchRequest, srv resourcepb.ResourceStore_WatchServer) error {
	return s.storage.Watch(req, srv)
}

// BlobStoreServer - delegate to storage

func (s *server) PutBlob(ctx context.Context, req *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
	return s.storage.PutBlob(ctx, req)
}

func (s *server) GetBlob(ctx context.Context, req *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
	return s.storage.GetBlob(ctx, req)
}

// QuotasServer - delegate to storage

func (s *server) GetQuotaUsage(ctx context.Context, req *resourcepb.QuotaUsageRequest) (*resourcepb.QuotaUsageResponse, error) {
	return s.storage.GetQuotaUsage(ctx, req)
}

// BulkStoreServer - delegate to storage

func (s *server) BulkProcess(stream resourcepb.BulkStore_BulkProcessServer) error {
	return s.storage.BulkProcess(stream)
}

// ResourceIndexServer - delegate to search

func (s *server) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	if s.search == nil {
		return nil, fmt.Errorf("search index not configured")
	}

	return s.search.Search(ctx, req)
}

// GetStats implements ResourceServer.
func (s *server) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	if s.search == nil {
		// If the backend implements "GetStats", we can use it
		srv, ok := s.storage.backend.(resourcepb.ResourceIndexServer)
		if ok {
			return srv.GetStats(ctx, req)
		}
		return nil, fmt.Errorf("search index not configured")
	}
	return s.search.GetStats(ctx, req)
}

// ManagedObjectIndexServer - delegate to search

func (s *server) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	if s.search == nil {
		return nil, fmt.Errorf("search index not configured")
	}

	return s.search.ListManagedObjects(ctx, req)
}

func (s *server) CountManagedObjects(ctx context.Context, req *resourcepb.CountManagedObjectsRequest) (*resourcepb.CountManagedObjectsResponse, error) {
	if s.search == nil {
		return nil, fmt.Errorf("search index not configured")
	}

	return s.search.CountManagedObjects(ctx, req)
}

func (s *server) RebuildIndexes(ctx context.Context, req *resourcepb.RebuildIndexesRequest) (*resourcepb.RebuildIndexesResponse, error) {
	if s.search == nil {
		return nil, fmt.Errorf("search index not configured")
	}

	return s.search.RebuildIndexes(ctx, req)
}

// DiagnosticsServer

func (s *server) IsHealthy(ctx context.Context, req *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	return s.storage.IsHealthy(ctx, req)
}
