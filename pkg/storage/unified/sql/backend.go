package sql

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/sql")

const defaultPollingInterval = 100 * time.Millisecond
const defaultWatchBufferSize = 100 // number of events to buffer in the watch stream
const defaultPrunerHistoryLimit = 20

type GarbageCollectionConfig struct {
	Enabled          bool
	Interval         time.Duration // how often the process runs
	BatchSize        int           // max number of candidates to delete (unique NGR)
	MaxAge           time.Duration // retention period
	DashboardsMaxAge time.Duration // dashboard retention
}

func ProvideStorageBackend(
	cfg *setting.Cfg,
) (resource.StorageBackend, error) {
	// TODO: make this the central place to provide SQL backend
	// Currently it is skipped as we need to handle the cases of Diagnostics and Lifecycle
	return nil, nil
}

// Backend interface for unified storage
type Backend interface {
	resource.StorageBackend
	resourcepb.DiagnosticsServer
	resource.LifecycleHooks
}

// BackendOptions for creating unified backend.
type BackendOptions struct {
	DBProvider              db.DBProvider
	Reg                     prometheus.Registerer
	PollingInterval         time.Duration
	WatchBufferSize         int
	IsHA                    bool
	storageMetrics          *resource.StorageMetrics
	GarbageCollection       GarbageCollectionConfig
	SimulatedNetworkLatency time.Duration
	LastImportTimeMaxAge    time.Duration
	EnableSearch            bool
	EnableStorage           bool
}

// backend composes storage and search support for resource.StorageBackend.
type backend struct {
	*baseBackend
	storage *storageBackendImpl
	search  *searchBackendImpl
}

// NewBackend creates a new unified backend that composes storage and search support.
func NewBackend(opts BackendOptions) (Backend, error) {
	if opts.DBProvider == nil {
		return nil, errors.New("no db provider")
	}

	if opts.PollingInterval == 0 {
		opts.PollingInterval = defaultPollingInterval
	}
	if opts.WatchBufferSize == 0 {
		opts.WatchBufferSize = defaultWatchBufferSize
	}

	// Default to enabling both storage and search for backward compatibility
	enableStorage := opts.EnableStorage || (!opts.EnableStorage && !opts.EnableSearch)
	enableSearch := opts.EnableSearch || (!opts.EnableStorage && !opts.EnableSearch)

	// Create shared base backend
	base, err := newBaseBackend(baseBackendOptions{
		DBProvider:     opts.DBProvider,
		Reg:            opts.Reg,
		StorageMetrics: opts.storageMetrics,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create base backend: %w", err)
	}
	backend := &backend{
		baseBackend: base,
	}

	// Create storage backend (with base)
	if enableStorage {
		backend.storage, err = newStorageBackendWithBase(base, storageBackendOptions{
			PollingInterval:         opts.PollingInterval,
			WatchBufferSize:         opts.WatchBufferSize,
			IsHA:                    opts.IsHA,
			GarbageCollection:       opts.GarbageCollection,
			SimulatedNetworkLatency: opts.SimulatedNetworkLatency,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create storage backend: %w", err)
		}
	}
	if enableSearch {
		// Create search support backend (shares same base)
		backend.search, err = newSearchBackendWithBase(base, searchBackendOptions{
			LastImportTimeMaxAge: opts.LastImportTimeMaxAge,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create search backend: %w", err)
		}
	}
	return backend, nil
}

// --- LifecycleHooks implementation ---

// Init initializes the unified backend (delegates to storage which initializes the base).
func (b *backend) Init(ctx context.Context) error {
	if err := b.baseBackend.Init(ctx); err != nil {
		return err
	}
	if b.storage != nil {
		if err := b.storage.Init(ctx); err != nil {
			return err
		}
	}
	if b.search != nil {
		if err := b.search.Init(ctx); err != nil {
			return err
		}
	}
	return nil
}

// Stop stops the unified backend.
func (b *backend) Stop(ctx context.Context) error {
	if b.storage != nil {
		return b.storage.Stop(ctx)
	}
	return b.baseBackend.Stop(ctx)
}

// --- DiagnosticsServer implementation ---

// IsHealthy checks if the database connection is healthy.
func (b *backend) IsHealthy(ctx context.Context, req *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	return b.baseBackend.IsHealthy(ctx, req)
}

// RebuildIndexes is not supported by the SQL backend.
func (b *backend) RebuildIndexes(ctx context.Context, req *resourcepb.RebuildIndexesRequest) (*resourcepb.RebuildIndexesResponse, error) {
	return nil, fmt.Errorf("rebuild indexes not supported by unistore sql backend")
}

// --- StorageWriter implementation ---

// WriteEvent implements resource.StorageWriter.
func (b *backend) WriteEvent(ctx context.Context, event resource.WriteEvent) (int64, error) {
	if b.storage == nil {
		return 0, errors.New("storage not enabled on this backend")
	}
	return b.storage.WriteEvent(ctx, event)
}

// ProcessBulk implements resource.BulkProcessingBackend.
func (b *backend) ProcessBulk(ctx context.Context, setting resource.BulkSettings, iter resource.BulkRequestIterator) *resourcepb.BulkResponse {
	if b.storage == nil {
		return &resourcepb.BulkResponse{
			Error: resource.AsErrorResult(errors.New("storage not enabled on this backend")),
		}
	}
	return b.storage.ProcessBulk(ctx, setting, iter)
}

// --- StorageReader implementation ---

// ReadResource implements resource.StorageReader.
// Delegates to baseBackend which has the shared read infrastructure.
func (b *backend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *resource.BackendReadResponse {
	return b.baseBackend.ReadResource(ctx, req)
}

// ListIterator implements resource.StorageReader.
// Delegates to baseBackend which has the shared read infrastructure.
func (b *backend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	return b.baseBackend.ListIterator(ctx, req, cb)
}

// ListHistory implements resource.StorageReader.
// Delegates to baseBackend which has the shared read infrastructure.
func (b *backend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	return b.baseBackend.ListHistory(ctx, req, cb)
}

// --- StorageWatcher implementation ---

// WatchWriteEvents implements resource.StorageWatcher.
func (b *backend) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	if b.storage == nil {
		return nil, errors.New("storage not enabled on this backend")
	}
	return b.storage.WatchWriteEvents(ctx)
}

// --- SearchSupport implementation ---

// GetResourceStats implements resource.SearchSupport.
func (b *backend) GetResourceStats(ctx context.Context, nsr resource.NamespacedResource, minCount int) ([]resource.ResourceStats, error) {
	if b.search == nil {
		return nil, errors.New("search not enabled on this backend")
	}
	return b.search.GetResourceStats(ctx, nsr, minCount)
}

// GetResourceLastImportTimes implements resource.SearchSupport.
func (b *backend) GetResourceLastImportTimes(ctx context.Context) iter.Seq2[resource.ResourceLastImportTime, error] {
	if b.search == nil {
		return func(yield func(resource.ResourceLastImportTime, error) bool) {}
	}
	return b.search.GetResourceLastImportTimes(ctx)
}

// ListModifiedSince implements resource.SearchSupport.
func (b *backend) ListModifiedSince(ctx context.Context, key resource.NamespacedResource, sinceRv int64) (int64, iter.Seq2[*resource.ModifiedResource, error]) {
	if b.search == nil {
		return 0, func(yield func(*resource.ModifiedResource, error) bool) {}
	}
	return b.search.ListModifiedSince(ctx, key, sinceRv)
}

// --- ResourceIndexServer implementation ---

// Support using SQL as fallback when the indexer is not running
var _ resourcepb.ResourceIndexServer = &backend{}

// GetStats implements resource.ResourceIndexServer.
// This will use the SQL index to count values
func (b *backend) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.GetStats")
	defer span.End()

	sreq := &sqlStatsRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   req.Namespace,
		Folder:      req.Folder,
	}

	rsp := &resourcepb.ResourceStatsResponse{}
	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		rows, err := dbutil.QueryRows(ctx, tx, sqlResourceStats, sreq)
		if err != nil {
			return err
		}
		for rows.Next() {
			row := resource.ResourceStats{}
			err = rows.Scan(&row.Namespace, &row.Group, &row.Resource, &row.Count, &row.ResourceVersion)
			if err != nil {
				return err
			}

			rsp.Stats = append(rsp.Stats, &resourcepb.ResourceStatsResponse_Stats{
				Group:    row.Group,
				Resource: row.Resource,
				Count:    row.Count,
			})
		}
		return err
	})
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
	}
	return rsp, nil
}

func (b *backend) RepositoryList(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	return nil, fmt.Errorf("SQL backend does not implement RepositoryList")
}

func (b *backend) RepositoryStats(context.Context, *resourcepb.CountManagedObjectsRequest) (*resourcepb.CountManagedObjectsResponse, error) {
	return nil, fmt.Errorf("SQL backend does not implement RepositoryStats")
}

// Search implements resource.ResourceIndexServer.
func (b *backend) Search(context.Context, *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	return &resourcepb.ResourceSearchResponse{
		Error: &resourcepb.ErrorResult{
			Code:    http.StatusNotImplemented,
			Message: "SQL backend does not implement Search",
		},
	}, nil
}
