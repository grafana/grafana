package resource

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"iter"
	"math/rand/v2"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/google/uuid"
	"github.com/grafana/dskit/backoff"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
	"github.com/grafana/grafana/pkg/util/debouncer"
)

const (
	defaultListBufferSize             = 100
	defaultEventRetentionPeriod       = 1 * time.Hour
	defaultEventPruningInterval       = 5 * time.Minute
	defaultSearchLookback             = 1 * time.Second
	defaultGarbageCollectionBatchWait = 1 * time.Second
)

type GarbageCollectionConfig struct {
	Enabled          bool
	DryRun           bool
	Interval         time.Duration // how often the process runs
	BatchSize        int           // max number of candidates to delete (unique NGR)
	BatchWait        time.Duration // wait between batches to avoid overwhelming the datastore
	MaxAge           time.Duration // retention period
	DashboardsMaxAge time.Duration // dashboard retention
}

// kvStorageBackend Unified storage backend based on KV storage.
type kvStorageBackend struct {
	snowflake               *snowflake.Node
	kv                      KV
	bulkLock                *BulkLock
	dataStore               *dataStore
	eventStore              *eventStore
	notifier                notifier
	log                     log.Logger
	disablePruner           bool
	dashboardVersionsToKeep int
	eventRetentionPeriod    time.Duration
	eventPruningInterval    time.Duration
	historyPruner           Pruner
	garbageCollection       GarbageCollectionConfig
	lastImportStore         *lastImportStore
	lastImportTimeMaxAge    time.Duration
	//reg     prometheus.Registerer
	metrics *kvBackendMetrics

	watchOpts WatchOptions

	rvManager *rvmanager.ResourceVersionManager

	// dbKeepAlive holds a reference to the database provider/connection owner to prevent it from being GC'd
	dbKeepAlive any

	// tenantWatcher watches Tenant CRDs for pending-delete state.
	// nil if tenant watching is not configured.
	tenantWatcher *TenantWatcher

	// tenantDeleter periodically deletes data for expired pending-delete tenants.
	// nil if tenant deletion is not configured.
	tenantDeleter *TenantDeleter

	searchLookback time.Duration

	// cancel stops all background goroutines owned by the backend.
	cancel context.CancelFunc
}

type kvBackendMetrics struct {
	ConflictErrors *prometheus.CounterVec
}

func newKVBackendMetrics(reg prometheus.Registerer) *kvBackendMetrics {
	return &kvBackendMetrics{
		ConflictErrors: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Namespace: "storage_server",
			Name:      "optimistic_lock_conflicts_total",
			Help:      "Total number of optimistic lock conflict errors in the KV storage backend",
		}, []string{"resource", "action"}),
	}
}

func (m *kvBackendMetrics) recordConflict(event WriteEvent) {
	if m == nil {
		return
	}
	m.ConflictErrors.WithLabelValues(event.Key.Resource, event.Type.String()).Inc()
}

var _ KVBackend = &kvStorageBackend{}

type KVBackend interface {
	StorageBackend
	resourcepb.DiagnosticsServer //nolint:staticcheck
	ResourceServerStopper
}

type KVBackendOptions struct {
	KvStore              KV
	DisablePruner        bool
	EventRetentionPeriod time.Duration         // How long to keep events (default: 1 hour)
	EventPruningInterval time.Duration         // How often to run the event pruning (default: 5 minutes)
	Reg                  prometheus.Registerer // TODO add metrics
	Log                  log.Logger
	GarbageCollection    GarbageCollectionConfig

	UseChannelNotifier bool
	WatchOptions       WatchOptions
	// Adding RvManager overrides the RV generated with snowflake in order to keep backwards compatibility with
	// unified/sql
	RvManager *rvmanager.ResourceVersionManager

	// dbKeepAlive holds a reference to the database provider/connection owner to prevent it from being GC'd
	// needed for sqlkv
	DBKeepAlive any

	// If not zero, the backend will regularly remove times from "last import times" older than this.
	LastImportTimeMaxAge time.Duration

	// TenantWatcherConfig, if set, enables watching Tenant CRDs for pending-delete state.
	TenantWatcherConfig *TenantWatcherConfig

	// TenantDeleterConfig, if set, enables periodic deletion of expired pending-delete tenant data.
	TenantDeleterConfig *TenantDeleterConfig

	// SearchLookback is the duration subtracted from sinceRv in calls to ListModifiedSince.
	// This guards against concurrent writes that commit slightly out-of-order. 0 means no lookback.
	SearchLookback time.Duration

	DashboardVersionsToKeep int
}

var (
	snowflakeOnce sync.Once
	snowflakeNode *snowflake.Node
	snowflakeErr  error
)

func getSnowflakeNode() (*snowflake.Node, error) {
	snowflakeOnce.Do(func() {
		snowflakeNode, snowflakeErr = snowflake.NewNode(rand.Int64N(1024))
	})
	return snowflakeNode, snowflakeErr
}

func NewKVStorageBackend(opts KVBackendOptions) (KVBackend, error) {
	kv := opts.KvStore

	logger := opts.Log
	if opts.Log == nil {
		logger = log.NewNopLogger()
	}

	s, err := getSnowflakeNode()
	if err != nil {
		return nil, fmt.Errorf("failed to create snowflake node: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	eventStore := newEventStore(kv)

	eventRetentionPeriod := opts.EventRetentionPeriod
	if eventRetentionPeriod <= 0 {
		eventRetentionPeriod = defaultEventRetentionPeriod
	}

	eventPruningInterval := opts.EventPruningInterval
	if eventPruningInterval <= 0 {
		eventPruningInterval = defaultEventPruningInterval
	}

	searchLookback := opts.SearchLookback
	if searchLookback < 0 {
		searchLookback = defaultSearchLookback
	}

	garbageCollection := opts.GarbageCollection
	if garbageCollection.BatchWait <= 0 {
		garbageCollection.BatchWait = defaultGarbageCollectionBatchWait
	}

	metrics := newKVBackendMetrics(opts.Reg)

	backend := &kvStorageBackend{
		kv:                      kv,
		bulkLock:                NewBulkLock(),
		dataStore:               newDataStore(kv, metrics),
		eventStore:              eventStore,
		notifier:                newNotifier(eventStore, notifierOptions{log: logger, useChannelNotifier: opts.UseChannelNotifier}),
		watchOpts:               opts.WatchOptions.normalize(),
		snowflake:               s,
		log:                     logger,
		eventRetentionPeriod:    eventRetentionPeriod,
		eventPruningInterval:    eventPruningInterval,
		rvManager:               opts.RvManager,
		dbKeepAlive:             opts.DBKeepAlive,
		lastImportStore:         newLastImportStore(kv),
		lastImportTimeMaxAge:    opts.LastImportTimeMaxAge,
		garbageCollection:       garbageCollection,
		searchLookback:          opts.SearchLookback,
		disablePruner:           opts.DisablePruner,
		dashboardVersionsToKeep: opts.DashboardVersionsToKeep,
		cancel:                  cancel,
		metrics:                 metrics,
	}
	err = backend.initPruner(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize pruner: %w", err)
	}
	if backend.garbageCollection.Enabled {
		if err := backend.initGarbageCollection(ctx); err != nil {
			return nil, fmt.Errorf("failed to initialize garbage collection: %w", err)
		}
	}

	// Optionally start the tenant watcher.
	if opts.TenantWatcherConfig != nil {
		tw, err := NewTenantWatcher(ctx, backend.dataStore, func(ctx context.Context, event *WriteEvent) (int64, error) {
			return backend.WriteEvent(ctx, *event)
		}, *opts.TenantWatcherConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to start tenant watcher: %w", err)
		}
		backend.tenantWatcher = tw
	}

	// Optionally start the tenant deleter.
	if opts.TenantDeleterConfig != nil {
		td := NewTenantDeleter(backend.dataStore, newPendingDeleteStore(backend.kv), *opts.TenantDeleterConfig)
		td.Start(ctx)
		backend.tenantDeleter = td
	}

	// Start the cleanup background job.
	go backend.runCleanups(ctx)

	logger.Info("backend initialized", "kv", fmt.Sprintf("%T", kv))

	return backend, nil
}

func (k *kvStorageBackend) IsHealthy(ctx context.Context, _ *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	type pinger interface {
		Ping(context.Context) error
	}
	if p, ok := k.kv.(pinger); ok {
		if err := p.Ping(ctx); err != nil {
			return &resourcepb.HealthCheckResponse{Status: resourcepb.HealthCheckResponse_NOT_SERVING}, fmt.Errorf("KV store health check failed: %w", err)
		}
	}
	return &resourcepb.HealthCheckResponse{Status: resourcepb.HealthCheckResponse_SERVING}, nil
}

// Stop shuts down services owned by the backend.
func (k *kvStorageBackend) Stop(_ context.Context) error {
	if k.historyPruner != nil {
		k.historyPruner.Stop()
	}
	if k.tenantWatcher != nil {
		k.tenantWatcher.Stop()
	}
	if k.tenantDeleter != nil {
		k.tenantDeleter.Stop()
	}
	// Cancel the background context to stop runCleanups, GC, and other goroutines.
	k.cancel()
	return nil
}

// runCleanups starts periodically cleans up old events and last import times.
func (k *kvStorageBackend) runCleanups(ctx context.Context) {
	// Run cleanup every hour
	ticker := time.NewTicker(k.eventPruningInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			k.log.Debug("Event cleanup stopped due to context cancellation")
			return
		case <-ticker.C:
			k.cleanupOldEvents(ctx)
			k.cleanupOldLastImportTimes(ctx)
		}
	}
}

func (k *kvStorageBackend) cleanupOldLastImportTimes(ctx context.Context) {
	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.cleanupOldLastImportTimes")
	defer span.End()

	if k.lastImportTimeMaxAge <= 0 {
		return
	}

	deleted, err := k.lastImportStore.CleanupLastImportTimes(ctx, k.lastImportTimeMaxAge)
	if err != nil {
		k.log.Error("Failed to cleanup last import times", "error", err)
	} else if deleted > 0 {
		k.log.Info("Cleaned up last import times", "deleted_count", deleted)
	}
}

// cleanupOldEvents performs the actual cleanup of old events
func (k *kvStorageBackend) cleanupOldEvents(ctx context.Context) {
	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.cleanupOldEvents")
	defer span.End()

	cutoff := time.Now().Add(-k.eventRetentionPeriod)
	deletedCount, err := k.eventStore.CleanupOldEvents(ctx, cutoff)
	if err != nil {
		k.log.Error("Failed to cleanup old events", "error", err)
		return
	}

	if deletedCount > 0 {
		k.log.Info("Cleaned up old events", "deleted_count", deletedCount, "retention_period", k.eventRetentionPeriod)
	}
}

func (k *kvStorageBackend) pruneEvents(ctx context.Context, key PruningKey) error {
	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.pruneEvents")
	defer span.End()

	if !key.Validate() {
		return fmt.Errorf("invalid pruning key: group, resource, and name must be set: %+v", key)
	}

	prunerMaxLimit := LookupPrunerHistoryLimit(key.Group, key.Resource, k.dashboardVersionsToKeep)
	counter := 0
	deleted := 0
	// iterate over all keys for the resource and delete versions beyond the configured limit
	for datakey, err := range k.dataStore.Keys(ctx, ListRequestKey{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
		Name:      key.Name,
	}, SortOrderDesc) {
		if err != nil {
			return err
		}

		// Pruner needs to exclude deleted events
		if counter < prunerMaxLimit && datakey.Action != DataActionDeleted {
			counter++
			continue
		}

		// If we already have the configured number of versions, delete any more create or update events
		if datakey.Action != DataActionDeleted {
			err := k.dataStore.Delete(ctx, datakey)
			if err != nil {
				return err
			}
			deleted += 1
		}
	}

	k.log.Debug("pruned history successfully",
		"namespace", key.Namespace,
		"group", key.Group,
		"resource", key.Resource,
		"name", key.Name,
		"rows", deleted)

	return nil
}

func (k *kvStorageBackend) initPruner(ctx context.Context) error {
	if k.disablePruner {
		k.log.Debug("Pruner disabled, using noop pruner")
		k.historyPruner = &NoopPruner{}
		return nil
	}

	k.log.Debug("Initializing history pruner")
	pruner, err := debouncer.NewGroup(debouncer.DebouncerOpts[PruningKey]{
		Name:           "history_pruner",
		BufferSize:     1000,
		MinWait:        time.Second * 30,
		MaxWait:        time.Minute * 5,
		ProcessHandler: k.pruneEvents,
		ErrorHandler: func(key PruningKey, err error) {
			k.log.Error("failed to prune history",
				"namespace", key.Namespace,
				"group", key.Group,
				"resource", key.Resource,
				"name", key.Name,
				"error", err)
		},
	})
	if err != nil {
		return err
	}

	k.historyPruner = pruner
	k.historyPruner.Start(ctx)
	return nil
}

func (b *kvStorageBackend) initGarbageCollection(ctx context.Context) error {
	b.log.Info("starting garbage collection loop")

	if b.garbageCollection.Interval <= 0 {
		b.log.Error("garbage collection interval must be greater than 0")
		return fmt.Errorf("garbage collection interval must be greater than 0")
	}

	go func() {
		// delay the first run by a random amount between 0 and the interval to avoid thundering herd
		jitter := time.Duration(rand.Int64N(b.garbageCollection.Interval.Nanoseconds()))
		select {
		case <-time.After(jitter):
		case <-ctx.Done():
			return
		}

		ticker := time.NewTicker(b.garbageCollection.Interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				b.runGarbageCollection(ctx, time.Now().Add(-b.garbageCollection.MaxAge).UnixMicro())
			}
		}
	}()

	return nil
}

// runGarbageCollection identifies deleted resources that are safe
// to be fully removed from the datastore and deletes them in batches.
func (b *kvStorageBackend) runGarbageCollection(ctx context.Context, cutoffTimeStamp int64) {
	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.runGarbageCollection")
	defer span.End()

	// get group and resources
	groupResources, err := b.dataStore.getGroupResources(ctx)
	if err != nil {
		b.log.Error("failed to list group resources for garbage collection", "error", err)
		return
	}

	// for each pair of group and resource
	for _, gr := range groupResources {
		// get the cutoff timestamp for this resource, allowing for resource-specific cutoff logic (e.g. different retention for dashboards)
		resourceCutoff := b.garbageCollectionCutoffTimestamp(gr.Group, gr.Resource, cutoffTimeStamp)

		// garbageCollectGroupResource will remove all deleted key for resources from a given group+resource
		// with resource versions older than the cutoff timestamp,
		err := b.garbageCollectGroupResource(ctx, gr.Group, gr.Resource, resourceCutoff)
		if err != nil {
			b.log.Error("garbage collection failed",
				"group", gr.Group,
				"resource", gr.Resource,
				"error", err)
			break
		}
	}
}

// garbageCollectGroupResource scans batches of entries in the datastore for a given group+resource,
// in descending order of resource version, looking for deleted entries with resource versions
// older than the cutoff timestamp.
// Once it finds a deleted entry, it looks for all previous versions of the same resource
// up to the deleted version and deletes them in batch.
// This ensures that we are not going to delete any keys that were created if the resource was recreated after deletion.
func (b *kvStorageBackend) garbageCollectGroupResource(ctx context.Context, group, resourceName string, cutoffTimestamp int64) error {
	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.garbageCollectGroupResource")
	batchSize := b.garbageCollection.BatchSize

	span.SetAttributes(attribute.String("group", group), attribute.String("resource", resourceName), attribute.Int64("cutoffTimestamp", cutoffTimestamp), attribute.Int("batchSize", batchSize))
	defer span.End()

	//nolint:staticcheck
	start := time.Now()

	totalDeleted := int64(0)
	totalDryRun := int64(0)

	// get the start and end keys for the list operation based on the resource prefix
	// for example, for dashboards, the start key will be "unified/data/dashboard.grafana.app/dashboards/"
	// and the end key will be "unified/data/dashboard.grafana.app/dashboards0"
	key := ListRequestKey{
		Group:    group,
		Resource: resourceName,
	}
	prefix := key.Prefix()
	startKey := prefix
	endKey := PrefixRangeEnd(prefix)

	// track keys that have been processed to avoid processing the same key twice
	seenKeys := map[ListRequestKey]struct{}{}

	// Data keys are group/resource/namespace/name/{rv}~…, so lexicographic order (asc or
	// desc) keeps all revisions for one resource contiguous. While iterating in descending
	// RV order, only the first key per ListRequestKey is the head revision; older rows for
	// the same resource are skipped. State persists across paginated batches.
	var currentResource ListRequestKey

	for {
		keysProcessed := int64(0)
		keysDeleted := int64(0)

		// traverse all keys in descending order of resource version,
		// for deleted keys with resource version older than the cutoff,
		// we will scan a fixed number of keys (batchSize) each time
		it := b.kv.Keys(ctx, kv.DataSection, kv.ListOptions{
			StartKey: startKey,
			EndKey:   endKey,
			Limit:    int64(batchSize),
			Sort:     kv.SortOrderDesc,
		})

		for dataKey, err := range it {
			if err != nil {
				return fmt.Errorf("failed to list collection before delete: %s", err)
			}

			keysProcessed++

			// parse the datakey to get the action and resource version
			dk, err := ParseKey(dataKey)
			if err != nil {
				return fmt.Errorf("failed to parse dataKey '%s': %s", dataKey, err)
			}

			// get the request key for the current datakey, which will be used to calculate the next start and end key
			k := ListRequestKey{
				Group:     dk.Group,
				Resource:  dk.Resource,
				Namespace: dk.Namespace,
				Name:      dk.Name,
			}

			// update the next end key for pagination. We will use this to continue scanning in the next batch
			// the next end key is the immediate previous key for the current key
			endKey = previousKey(dataKey)

			if k == currentResource {
				// Older revision for a resource we already handled at its head key.
				continue
			}
			currentResource = k

			// if the action is deleted and the resource version is older than the cutoff, get all previous versions
			// of the same resource and delete them in batch
			if dk.Action == DataActionDeleted && dk.ResourceVersion < cutoffTimestamp {
				// ensure we don't process/count the same resource twice
				if _, seen := seenKeys[k]; seen {
					continue
				}
				// mark the key as seen
				seenKeys[k] = struct{}{}

				startKeyToDelete := k.Prefix()
				// end key is exclusive, so we need to add a suffix to make sure we include all the versions we want to delete
				endKeyToDelete := PrefixRangeEnd(dk.String())

				keysToDelete := []string{}
				for deleteKey, err := range b.kv.Keys(ctx, kv.DataSection, ListOptions{
					StartKey: startKeyToDelete,
					EndKey:   endKeyToDelete,
					Sort:     kv.SortOrderAsc,
				}) {
					if err != nil {
						return fmt.Errorf("failed to get keys for resource '%s': %s", dk, err)
					}
					keysToDelete = append(keysToDelete, deleteKey)
				}

				// check if the resource still exists
				_, err := b.dataStore.GetLatestResourceKey(ctx, GetRequestKey{
					Group:     dk.Group,
					Resource:  dk.Resource,
					Namespace: dk.Namespace,
					Name:      dk.Name,
				})
				if err == nil {
					// resource still exists, no need to delete anything
					continue
				}
				if !errors.Is(err, ErrNotFound) {
					return fmt.Errorf("garbage collection: latest resource key lookup for %s: %w", dk, err)
				}

				if b.garbageCollection.DryRun {
					// if in dry run mode, just count the keys to delete
					totalDryRun += int64(len(keysToDelete))
					continue
				}

				// if not in dry run mode, batch delete the keys
				err = b.kv.BatchDelete(ctx, kv.DataSection, keysToDelete)
				if err != nil {
					return fmt.Errorf("failed to batch delete keys: %s", err)
				}

				// update the total number of keys deleted
				keysDeleted = keysDeleted + int64(len(keysToDelete))
			}
		}

		// if there are no more entries to process, break the loop
		if keysProcessed == 0 {
			break
		}

		totalDeleted += keysDeleted

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(b.garbageCollection.BatchWait):
		}
	}

	if totalDeleted > 0 {
		b.log.Info("garbage collection deleted history",
			"group", group,
			"resource", resourceName,
			"rows", totalDeleted,
			"seconds", time.Since(start).Seconds(),
		)
	}

	if totalDryRun > 0 {
		b.log.Info("garbage collection dry run",
			"group", group,
			"resource", resourceName,
			"rows", totalDryRun,
			"seconds", time.Since(start).Seconds(),
		)
	}

	return nil
}

// previousKey returns the immediate previous key for the given key
// for example, if the key is "unified/data/dashboard.grafana.app/dashboards/123-bbb",
// the previous key will be "unified/data/dashboard.grafana.app/dashboards/123-bba"
func previousKey(key string) string {
	keyBuf := []byte(key)
	buf := make([]byte, len(keyBuf))
	copy(buf, keyBuf)
	for i := len(buf) - 1; i >= 0; i-- {
		if buf[i] > 0x00 {
			buf[i] = buf[i] - 1
			buf = buf[:i+1]
			return string(buf)
		}
	}
	return string(buf)
}

func (b *kvStorageBackend) garbageCollectionCutoffTimestamp(group, resourceName string, defaultCutoff int64) int64 {
	cutoffTimestamp := defaultCutoff

	if group == "dashboard.grafana.app" && resourceName == "dashboards" {
		cutoffTimestamp = time.Now().Add(-b.garbageCollection.DashboardsMaxAge).UnixMicro()
	}

	if !IsSnowflake(cutoffTimestamp) {
		cutoffTimestamp = rvmanager.SnowflakeFromRV(cutoffTimestamp)
	}
	return cutoffTimestamp
}

// toSnowflakeRV converts a microsecond RV to snowflake format if needed.
// This ensures the KV backend is compatible with both RV formats during the
// backend transition period.
//
// TODO: remove when compatibility with SQL backend is no longer needed.
func toSnowflakeRV(rv int64) int64 {
	if rv > 0 && !IsSnowflake(rv) {
		return rvmanager.SnowflakeFromRV(rv)
	}
	return rv
}

func conflictError(event WriteEvent, message string) error {
	return NewConflictStatusError(
		event.Key.Group, event.Key.Resource, event.Key.Name, message,
	)
}

// WriteEvent writes a resource event (create/update/delete) to the storage backend.
//
//nolint:gocyclo
func (k *kvStorageBackend) WriteEvent(ctx context.Context, event WriteEvent) (int64, error) {
	if err := event.Validate(); err != nil {
		return 0, apierrors.NewBadRequest(err.Error())
	}

	event.PreviousRV = toSnowflakeRV(event.PreviousRV)

	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.WriteEvent", trace.WithAttributes(
		attribute.String("event_type", event.Type.String()),
		attribute.String("group", event.Key.Group),
		attribute.String("resource", event.Key.Resource),
		attribute.String("namespace", event.Key.Namespace),
	))
	defer span.End()

	rv := k.snowflake.Generate().Int64()

	namespace := event.Key.Namespace

	// When PreviousRV is not 0, fetch the latest resource and verify that the RV matches the PreviousRV
	if event.PreviousRV != 0 {
		latestKey, err := k.dataStore.GetLatestResourceKey(ctx, GetRequestKey{
			Group:     event.Key.Group,
			Resource:  event.Key.Resource,
			Namespace: namespace,
			Name:      event.Key.Name,
		})
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				// Resource doesn't exist, but PreviousRV was provided
				k.metrics.recordConflict(event)
				return 0, conflictError(event, "resource not found")
			}
			return 0, fmt.Errorf("failed to fetch latest resource: %w", err)
		}

		// Verify the current RV matches the PreviousRV
		if latestKey.ResourceVersion != event.PreviousRV {
			k.metrics.recordConflict(event)
			return 0, conflictError(event, "requested RV does not match current RV")
		}
	}

	obj := event.Object
	// Write data.
	var action kv.DataAction
	switch event.Type {
	case resourcepb.WatchEvent_ADDED:
		action = DataActionCreated
		// Check if resource already exists for create operations
		latestKey, err := k.dataStore.GetLatestResourceKey(ctx, GetRequestKey{
			Group:     event.Key.Group,
			Resource:  event.Key.Resource,
			Namespace: namespace,
			Name:      event.Key.Name,
		})
		if err == nil {
			if latestKey.Action == kv.DataActionUpdated {
				return 0, ErrResourceAlreadyExists
			}

			// A creation event was found, but it might be a transient write from a
			// concurrent create that hasn't gone through the optimistic lock
			// checks. Confirm via the event store before returning AlreadyExists.
			committed, err := k.confirmExistence(ctx, latestKey)
			if err != nil {
				return 0, fmt.Errorf("checking concurrent creation in event store: %w", err)
			}
			if committed {
				return 0, ErrResourceAlreadyExists
			}
			// Not confirmed: the data is likely transient. Proceed with the
			// write and let the optimistic lock checks determine the winner.
		} else if !errors.Is(err, ErrNotFound) {
			return 0, fmt.Errorf("failed to check if resource exists: %w", err)
		}
	case resourcepb.WatchEvent_MODIFIED:
		action = DataActionUpdated
	case resourcepb.WatchEvent_DELETED:
		action = DataActionDeleted
		obj = event.ObjectOld
	default:
		return 0, fmt.Errorf("invalid event type: %d", event.Type)
	}

	if obj == nil {
		return 0, fmt.Errorf("object is nil")
	}

	// Write the data
	dataKey := DataKey{
		Group:           event.Key.Group,
		Resource:        event.Key.Resource,
		Namespace:       namespace,
		Name:            event.Key.Name,
		ResourceVersion: rv,
		Action:          action,
		Folder:          obj.GetFolder(),
	}

	if k.rvManager != nil {
		dataKey.GUID = uuid.New().String()
		var err error
		rv, err = k.rvManager.ExecWithRV(ctx, event.Key, func(txnCtx context.Context, tx db.Tx) (string, error) {
			if err := k.dataStore.Save(kv.ContextWithTx(txnCtx, tx), dataKey, bytes.NewReader(event.Value)); err != nil {
				return "", fmt.Errorf("failed to write data: %w", err)
			}

			if err := k.dataStore.applyBackwardsCompatibleChanges(txnCtx, tx, event, dataKey); err != nil {
				return "", fmt.Errorf("failed to apply backwards compatible updates: %w", err)
			}

			return dataKey.GUID, nil
		})
		if err != nil {
			return 0, fmt.Errorf("failed to write data: %w", err)
		}

		rv = rvmanager.SnowflakeFromRV(rv)
		dataKey.ResourceVersion = rv
	} else {
		err := k.dataStore.Save(ctx, dataKey, bytes.NewReader(event.Value))
		if err != nil {
			return 0, fmt.Errorf("failed to write data: %w", err)
		}
	}

	// Optimistic concurrency control to verify our write is the latest version
	// and that the resource still had the expected PreviousRV when we wrote it
	if event.PreviousRV != 0 {
		// Update operations: verify PreviousRV matches and our write is latest
		// Get both the latest and predecessor
		latestKey, prevKey, err := k.dataStore.GetLatestAndPredecessor(ctx, ListRequestKey{
			Group:     event.Key.Group,
			Resource:  event.Key.Resource,
			Namespace: namespace,
			Name:      event.Key.Name,
		})
		if err != nil {
			// If we can't read the latest version, clean up what we wrote
			_ = k.dataStore.Delete(ctx, dataKey)
			return 0, fmt.Errorf("failed to check latest version: %w", err)
		}

		// Check if the RV we just wrote is the latest. If not, a concurrent write with higher RV happened
		if latestKey.ResourceVersion != dataKey.ResourceVersion {
			// Delete the data we just wrote since it's not the latest
			_ = k.dataStore.Delete(ctx, dataKey)
			k.metrics.recordConflict(event)
			return 0, conflictError(event, "concurrent modification detected")
		}

		if !rvmanager.IsRvEqual(prevKey.ResourceVersion, event.PreviousRV) {
			// Another concurrent write happened between our read and write
			_ = k.dataStore.Delete(ctx, dataKey)
			k.metrics.recordConflict(event)
			return 0, conflictError(event, "resource was modified concurrently")
		}
	} else if event.Type == resourcepb.WatchEvent_ADDED {
		// Create operations: verify our write is the latest version
		latestKey, prevKey, err := k.dataStore.GetLatestAndPredecessor(ctx, ListRequestKey{
			Group:     event.Key.Group,
			Resource:  event.Key.Resource,
			Namespace: namespace,
			Name:      event.Key.Name,
		})
		if err != nil {
			// If we can't read the latest version, clean up what we wrote
			_ = k.dataStore.Delete(ctx, dataKey)
			return 0, fmt.Errorf("failed to check latest version: %w", err)
		}

		// Check if the RV we just wrote is the latest. If not, a concurrent create with higher RV happened
		if latestKey.ResourceVersion != dataKey.ResourceVersion {
			// Delete the data we just wrote since it's not the latest
			_ = k.dataStore.Delete(ctx, dataKey)
			k.metrics.recordConflict(event)
			return 0, conflictError(event, "concurrent create detected")
		}

		// Verify that the immediate predecessor is not a create
		if prevKey.Action == DataActionCreated {
			// Another concurrent create happened - delete our write and return error
			_ = k.dataStore.Delete(ctx, dataKey)
			k.metrics.recordConflict(event)
			return 0, conflictError(event, "concurrent create attempts detected")
		}
	}

	// Write event
	eventData := Event{
		Namespace:       namespace,
		Group:           event.Key.Group,
		Resource:        event.Key.Resource,
		Name:            event.Key.Name,
		ResourceVersion: dataKey.ResourceVersion,
		Action:          action,
		Folder:          obj.GetFolder(),
		PreviousRV:      event.PreviousRV,
	}
	err := k.eventStore.Save(ctx, eventData)
	if err != nil {
		// Clean up the data we wrote since event save failed
		_ = k.dataStore.Delete(ctx, dataKey)
		return 0, fmt.Errorf("failed to save event: %w", err)
	}

	_ = k.historyPruner.Add(PruningKey{
		Namespace: namespace,
		Group:     event.Key.Group,
		Resource:  event.Key.Resource,
		Name:      event.Key.Name,
	})
	k.notifier.Publish(eventData)

	return rv, nil
}

// confirmExistence checks whether a resource with the given `key` is genuinely
// committed. During concurrent creates, the datastore can contain transient
// writes that haven't survived the post-write optimistic lock checks. The
// eventstore is used as a commit signal: an event is written only after the
// optimistic locking checks, so its presence proves the write is committed.
func (k *kvStorageBackend) confirmExistence(ctx context.Context, key DataKey) (bool, error) {
	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.confirmExistence")
	defer span.End()

	const eventThreshold = 30 * time.Second

	// Extract the timestamp from the snowflake-formatted RV.
	rvTime := time.Unix(0, snowflake.ID(key.ResourceVersion).Time()*int64(time.Millisecond))
	if time.Since(rvTime) > eventThreshold {
		// Old RV: by this point, it can be assumed to be committed.
		return true, nil
	}

	// Recent RV: look up the corresponding event to confirm it was committed.
	_, err := k.eventStore.Get(ctx, EventKey{
		Namespace:       key.Namespace,
		Group:           key.Group,
		Resource:        key.Resource,
		Name:            key.Name,
		ResourceVersion: key.ResourceVersion,
		Action:          key.Action,
		Folder:          key.Folder,
	})
	if err == nil {
		return true, nil
	}
	if errors.Is(err, ErrNotFound) {
		return false, nil
	}
	return false, err
}

func (k *kvStorageBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	if req.Key == nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusBadRequest, Message: "missing key"}}
	}

	req.ResourceVersion = toSnowflakeRV(req.ResourceVersion)

	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.ReadResource", trace.WithAttributes(
		attribute.String("namespace", req.Key.Namespace),
		attribute.String("group", req.Key.Group),
		attribute.String("resource", req.Key.Resource),
		attribute.String("name", req.Key.Name),
	))
	defer span.End()

	namespace := req.Key.Namespace

	// If a specific resource version is requested, validate that it's not too high
	if req.ResourceVersion > 0 {
		// Fetch the latest RV
		latestRV := k.snowflake.Generate().Int64()
		if lastEventKey, err := k.eventStore.LastEventKey(ctx); err == nil {
			latestRV = lastEventKey.ResourceVersion
		} else if !errors.Is(err, ErrNotFound) {
			return &BackendReadResponse{Error: &resourcepb.ErrorResult{
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to fetch latest resource version: %v", err),
			}}
		}

		// Check if the requested RV is higher than the latest available RV
		if req.ResourceVersion > latestRV {
			return &BackendReadResponse{
				Error: NewBadRequestError(fmt.Sprintf("too large resource version: %d (current %d)", req.ResourceVersion, latestRV)),
			}
		}
	}

	meta, err := k.dataStore.GetResourceKeyAtRevision(ctx, GetRequestKey{
		Group:     req.Key.Group,
		Resource:  req.Key.Resource,
		Namespace: namespace,
		Name:      req.Key.Name,
	}, req.ResourceVersion)
	if errors.Is(err, ErrNotFound) {
		return &BackendReadResponse{Error: NewNotFoundError(req.Key)}
	} else if err != nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: err.Error()}}
	}
	data, err := k.dataStore.Get(ctx, DataKey{
		Group:           req.Key.Group,
		Resource:        req.Key.Resource,
		Namespace:       namespace,
		Name:            req.Key.Name,
		ResourceVersion: meta.ResourceVersion,
		Action:          meta.Action,
		Folder:          meta.Folder,
	})
	if err != nil || data == nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: err.Error()}}
	}
	value, err := readAndClose(data)
	if err != nil {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: err.Error()}}
	}
	return &BackendReadResponse{
		Key:             req.Key,
		ResourceVersion: meta.ResourceVersion,
		Value:           value,
		Folder:          meta.Folder,
	}
}

// ListIterator returns an iterator for listing resources.
func (k *kvStorageBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(ListIterator) error) (int64, error) {
	if req.Options == nil || req.Options.Key == nil {
		return 0, fmt.Errorf("missing options or key in ListRequest")
	}

	req.ResourceVersion = toSnowflakeRV(req.ResourceVersion)

	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.ListIterator", trace.WithAttributes(
		attribute.String("namespace", req.Options.Key.Namespace),
		attribute.String("group", req.Options.Key.Group),
		attribute.String("resource", req.Options.Key.Resource),
	))
	defer span.End()

	// Parse continue token if provided
	listOptions := ListRequestOptions{
		Key: ListRequestKey{
			Group:     req.Options.Key.Group,
			Resource:  req.Options.Key.Resource,
			Namespace: req.Options.Key.Namespace,
			Name:      req.Options.Key.Name,
		},
		ResourceVersion: req.ResourceVersion,
	}

	if req.NextPageToken != "" {
		token, err := GetContinueToken(req.NextPageToken)
		if err != nil {
			return 0, fmt.Errorf("invalid continue token: %w", err)
		}
		if token.Name == "" {
			return 0, fmt.Errorf("invalid continue token: name is required for list resources")
		}
		// Only use token namespace for cross-namespace queries (when request namespace is empty)
		if req.Options.Key.Namespace == "" {
			listOptions.ContinueNamespace = token.Namespace
		}
		listOptions.ContinueName = token.Name
		listOptions.ResourceVersion = toSnowflakeRV(token.ResourceVersion)
	}

	// We set the listRV to the last event resource version.
	// If no events exist yet, we generate a new snowflake.
	listRV := k.snowflake.Generate().Int64()
	if lastEventKey, err := k.eventStore.LastEventKey(ctx); err == nil {
		listRV = lastEventKey.ResourceVersion
	} else if !errors.Is(err, ErrNotFound) {
		return 0, fmt.Errorf("failed to fetch last event: %w", err)
	}

	if listOptions.ResourceVersion > 0 {
		listRV = listOptions.ResourceVersion
	}

	// Fetch the latest objects
	keys := make([]DataKey, 0, min(defaultListBufferSize, req.Limit+1))
	for dataKey, err := range k.dataStore.ListResourceKeysAtRevision(ctx, listOptions) {
		if err != nil {
			return 0, err
		}

		keys = append(keys, dataKey)
		// Only fetch the first limit items + 1 to get the next token.
		if req.Limit > 0 && len(keys) >= int(req.Limit+1) {
			break
		}
	}
	iter := newKvListIterator(ctx, k.dataStore, keys, listRV, req.Options.Key.Namespace == "")
	defer iter.stop()

	err := cb(iter)
	if err != nil {
		return 0, err
	}

	return listRV, nil
}

const (
	// maxKvListIteratorConsecutiveFailures caps back-to-back retries with zero
	// progress; the counter resets when an attempt yields a key.
	maxKvListIteratorConsecutiveFailures = 3
	// maxKvListIteratorTotalAttempts bounds total retryable failures to stop
	// slow-drip loops (1 key per attempt, always fails) from hanging.
	maxKvListIteratorTotalAttempts = 10
)

// kvListIteratorBackoff is the default backoff config used between retry attempts.
var kvListIteratorBackoff = backoff.Config{
	MinBackoff: time.Second,
	MaxBackoff: 10 * time.Second,
}

var batchGetRetryLogger = log.New("kv-batchget-retry")

type batchGetRetryPull struct {
	ctx       context.Context
	dataStore *dataStore
	keys      []DataKey
	keyIdx    map[DataKey]int // first-occurrence position of each key
	nextIdx   int             // next not-yet-yielded position in keys
	stopFn    func()
	retryBo   *backoff.Backoff

	consecutiveFailures int
	totalFailures       int

	next func() (DataObj, error, bool)
}

// newBatchGetRetryPull builds a pull-style iterator over dataStore.BatchGet that
// retries on kv.ErrRetryable failures
func newBatchGetRetryPull(ctx context.Context, ds *dataStore, keys []DataKey) *batchGetRetryPull {
	keyIdx := make(map[DataKey]int, len(keys))
	for idx, dk := range keys {
		if _, ok := keyIdx[dk]; !ok {
			keyIdx[dk] = idx
		}
	}
	p := &batchGetRetryPull{
		ctx:       ctx,
		dataStore: ds,
		keys:      keys,
		keyIdx:    keyIdx,
		retryBo:   backoff.New(ctx, kvListIteratorBackoff),
	}
	p.next, p.stopFn = iter.Pull2(p.dataStore.BatchGet(p.ctx, keys))
	return p
}

// fetch reads the next (DataObj, err, hasMore) from the current pull.
// Retryable errors are handled before returning.
func (p *batchGetRetryPull) fetch() (DataObj, error, bool) {
	obj, err, ok := p.next()
	for ok && err != nil {
		canRetry, retryErr := p.tryRetry(err)
		if retryErr != nil {
			return obj, retryErr, ok
		}
		if !canRetry {
			return obj, err, ok
		}
		obj, err, ok = p.next()
	}
	return obj, err, ok
}

// tryRetry consumes a retry budget slot, waits the backoff, and
// re-opens the pull at keys[nextIdx:] if the error is kv.ErrRetryable.
// Returns (true, nil) if the caller may retry the current iteration
// Returns (false, nil) if the error is not retryable or budget is exhausted
// Returns (false, err) if the wait was aborted (e.g. ctx cancelled).
func (p *batchGetRetryPull) tryRetry(err error) (bool, error) {
	p.totalFailures++
	p.consecutiveFailures++
	if !errors.Is(err, kv.ErrRetryable) {
		return false, nil
	}
	logArgs := []any{
		"next_idx", p.nextIdx,
		"remaining_keys", len(p.keys) - p.nextIdx,
		"total_failures", p.totalFailures,
		"consecutive_failures", p.consecutiveFailures,
		"error", err,
	}
	if p.totalFailures >= maxKvListIteratorTotalAttempts {
		batchGetRetryLogger.Warn("kv BatchGet retry budget exhausted (total attempts)", logArgs...)
		return false, nil
	}
	if p.consecutiveFailures >= maxKvListIteratorConsecutiveFailures {
		batchGetRetryLogger.Warn("kv BatchGet retry budget exhausted (consecutive failures)", logArgs...)
		return false, nil
	}
	batchGetRetryLogger.Warn("kv BatchGet retrying after retryable error", logArgs...)
	p.stop()
	p.retryBo.Wait()
	if bErr := p.retryBo.Err(); bErr != nil {
		return false, bErr
	}
	p.next, p.stopFn = iter.Pull2(p.dataStore.BatchGet(p.ctx, p.keys[p.nextIdx:]))
	return true, nil
}

// advance marks key as yielded and resets the consecutive-failure counter.
func (p *batchGetRetryPull) advance(key DataKey) {
	p.consecutiveFailures = 0
	p.retryBo.Reset()
	if idx, ok := p.keyIdx[key]; ok && idx >= p.nextIdx {
		p.nextIdx = idx + 1
	}
}

// stop closes the current pull.
func (p *batchGetRetryPull) stop() {
	if p.stopFn != nil {
		p.stopFn()
		p.stopFn = nil
	}
}

// newKvListIterator builds a kvListIterator over dataStore.BatchGet(keys).
func newKvListIterator(ctx context.Context, ds *dataStore, keys []DataKey, listRV int64, isCrossNamespace bool) *kvListIterator {
	return &kvListIterator{
		listRV:           listRV,
		isCrossNamespace: isCrossNamespace,
		pull:             newBatchGetRetryPull(ctx, ds, keys),
	}
}

type kvListIterator struct {
	listRV           int64
	isCrossNamespace bool

	pull *batchGetRetryPull

	// current item state
	started        bool
	currentDataObj DataObj
	value          []byte
	err            error
	nextDataObj    DataObj
	nextErr        error
	hasMore        bool
}

// stop closes the underlying pull. Callers should defer this.
func (i *kvListIterator) stop() { i.pull.stop() }

func (i *kvListIterator) Next() bool {
	if !i.started {
		i.started = true
		i.nextDataObj, i.nextErr, i.hasMore = i.pull.fetch()
	}

	for {
		if !i.hasMore {
			return false
		}

		i.currentDataObj, i.err = i.nextDataObj, i.nextErr
		if i.err != nil {
			if i.shouldRetry(i.err) {
				i.nextDataObj, i.nextErr, i.hasMore = i.pull.fetch()
				continue
			}
			return false
		}

		i.value, i.err = readAndClose(i.currentDataObj.Value)
		if i.err != nil {
			if i.shouldRetry(i.err) {
				i.nextDataObj, i.nextErr, i.hasMore = i.pull.fetch()
				continue
			}
			return false
		}

		// Success: advance past the yielded key and fetch next entry
		i.pull.advance(i.currentDataObj.Key)
		i.nextDataObj, i.nextErr, i.hasMore = i.pull.fetch()
		return true
	}
}

func (i *kvListIterator) shouldRetry(err error) bool {
	canRetry, retryErr := i.pull.tryRetry(err)
	if retryErr != nil {
		i.err = retryErr
	}
	return canRetry
}

func (i *kvListIterator) Error() error {
	return i.err
}

func (i *kvListIterator) ContinueToken() string {
	token := ContinueToken{
		Name:            i.nextDataObj.Key.Name,
		ResourceVersion: i.listRV,
	}
	// Only store namespace in token for cross-namespace queries
	if i.isCrossNamespace {
		token.Namespace = i.nextDataObj.Key.Namespace
	}
	return token.String()
}

func (i *kvListIterator) ResourceVersion() int64 {
	return i.currentDataObj.Key.ResourceVersion
}

func (i *kvListIterator) Namespace() string {
	return i.currentDataObj.Key.Namespace
}

func (i *kvListIterator) Name() string {
	return i.currentDataObj.Key.Name
}

func (i *kvListIterator) Folder() string {
	return i.currentDataObj.Key.Folder
}

func (i *kvListIterator) Value() []byte {
	return i.value
}

func validateListHistoryRequest(req *resourcepb.ListRequest) error {
	if req.Options == nil || req.Options.Key == nil {
		return fmt.Errorf("missing options or key in ListRequest")
	}
	key := req.Options.Key
	if key.Group == "" {
		return fmt.Errorf("group is required")
	}
	if key.Resource == "" {
		return fmt.Errorf("resource is required")
	}

	// Name is required for non-trash listings
	if req.Source != resourcepb.ListRequest_TRASH && key.Name == "" {
		return fmt.Errorf("name is required for non-trash history listing")
	}

	// Exact match with RV=0 is invalid
	if req.GetVersionMatchV2() == resourcepb.ResourceVersionMatchV2_Exact && req.ResourceVersion == 0 {
		return fmt.Errorf("expecting an explicit resource version query when using Exact matching")
	}

	return nil
}

// filterHistoryKeysByVersion filters history keys based on version match criteria
func filterHistoryKeysByVersion(historyKeys []DataKey, req *resourcepb.ListRequest) ([]DataKey, error) {
	switch req.GetVersionMatchV2() {
	case resourcepb.ResourceVersionMatchV2_Exact:
		exactKeys := make([]DataKey, 0, len(historyKeys))
		for _, key := range historyKeys {
			if key.ResourceVersion == req.ResourceVersion {
				exactKeys = append(exactKeys, key)
			}
		}
		return exactKeys, nil
	case resourcepb.ResourceVersionMatchV2_NotOlderThan:
		if req.ResourceVersion > 0 {
			filteredKeys := make([]DataKey, 0, len(historyKeys))
			for _, key := range historyKeys {
				if key.ResourceVersion >= req.ResourceVersion {
					filteredKeys = append(filteredKeys, key)
				}
			}
			return filteredKeys, nil
		}
	default:
		if req.ResourceVersion > 0 {
			filteredKeys := make([]DataKey, 0, len(historyKeys))
			for _, key := range historyKeys {
				if key.ResourceVersion <= req.ResourceVersion {
					filteredKeys = append(filteredKeys, key)
				}
			}
			return filteredKeys, nil
		}
	}
	return historyKeys, nil
}

// applyLiveHistoryFilter applies "live" history logic by ignoring events before the last delete
func applyLiveHistoryFilter(filteredKeys []DataKey, req *resourcepb.ListRequest) []DataKey {
	useLatestDeletionAsMinRV := req.ResourceVersion == 0 && req.Source != resourcepb.ListRequest_TRASH && req.GetVersionMatchV2() != resourcepb.ResourceVersionMatchV2_Exact
	if !useLatestDeletionAsMinRV {
		return filteredKeys
	}

	latestDeleteRV := int64(0)
	for _, key := range filteredKeys {
		if key.Action == DataActionDeleted && key.ResourceVersion > latestDeleteRV {
			latestDeleteRV = key.ResourceVersion
		}
	}
	if latestDeleteRV > 0 {
		liveKeys := make([]DataKey, 0, len(filteredKeys))
		for _, key := range filteredKeys {
			if key.ResourceVersion > latestDeleteRV {
				liveKeys = append(liveKeys, key)
			}
		}
		return liveKeys
	}
	return filteredKeys
}

// applyPagination filters keys based on pagination parameters (descending order only)
func applyPagination(keys []DataKey, lastSeenRV int64) []DataKey {
	if lastSeenRV == 0 {
		return keys
	}

	pagedKeys := make([]DataKey, 0, len(keys))
	for _, key := range keys {
		if key.ResourceVersion < lastSeenRV {
			pagedKeys = append(pagedKeys, key)
		}
	}
	return pagedKeys
}

// ListModifiedSince returns all resources that have changed since the given
// resource version. If searchLookback is non-zero, a lookback window is applied
// so that events committed concurrently with the previous call are not missed.
// Because of this, callers may receive events with resource versions slightly
// before sinceRv. If a `lastCalledWithSinceRv` parameter is passed, the
// lookback may be skipped as an optimization.
func (k *kvStorageBackend) ListModifiedSince(ctx context.Context, key NamespacedResource, sinceRv int64, lastCalledWithSinceRv *time.Time) (int64, iter.Seq2[*ModifiedResource, error]) {
	if !key.Valid() {
		return 0, func(yield func(*ModifiedResource, error) bool) {
			yield(nil, fmt.Errorf("group, resource, and namespace are required"))
		}
	}

	if sinceRv <= 0 {
		return 0, func(yield func(*ModifiedResource, error) bool) {
			yield(nil, fmt.Errorf("sinceRv must be greater than 0"))
		}
	}

	sinceRv = toSnowflakeRV(sinceRv)

	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.ListModifiedSince", trace.WithAttributes(
		attribute.String("namespace", key.Namespace),
		attribute.String("group", key.Group),
		attribute.String("resource", key.Resource),
		attribute.Int64("sinceRv", sinceRv),
	))
	defer span.End()

	latestEvent, err := k.eventStore.LastEventKey(ctx)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return sinceRv, func(yield func(*ModifiedResource, error) bool) { /* nothing to return */ }
		}

		return 0, func(yield func(*ModifiedResource, error) bool) {
			yield(nil, fmt.Errorf("error trying to retrieve last event key: %w", err))
		}
	}

	// Determine whether to apply the lookback window. If the caller has previously
	// called with this same sinceRv and enough wall-clock time has elapsed since that
	// call, any in-flight concurrent writes at sinceRv time must have committed, so
	// lookback is unnecessary.
	sinceRvTimestamp := snowflake.ID(sinceRv).Time()
	sinceRvTime := time.Unix(0, sinceRvTimestamp*int64(time.Millisecond))

	var effectiveRv int64
	if k.searchLookback == 0 {
		effectiveRv = sinceRv
	} else {
		skipLookback := lastCalledWithSinceRv != nil && (*lastCalledWithSinceRv).Sub(sinceRvTime) > k.searchLookback
		if skipLookback {
			effectiveRv = sinceRv
		} else {
			effectiveRv = subtractDurationFromSnowflake(sinceRv, k.searchLookback)
		}
	}

	// If no new events since effectiveRv, return early and avoid doing a range query.
	if latestEvent.ResourceVersion <= effectiveRv {
		return latestEvent.ResourceVersion, func(yield func(*ModifiedResource, error) bool) { /* nothing to return */ }
	}

	sinceRvAge := time.Since(sinceRvTime)

	if sinceRvAge > time.Hour {
		k.log.Debug("ListModifiedSince using data store", "sinceRv", sinceRv, "sinceRvAge", sinceRvAge, "searchLookback", k.searchLookback)
		return latestEvent.ResourceVersion, k.listModifiedSinceDataStore(ctx, key, effectiveRv)
	}

	k.log.Debug("ListModifiedSince using event store", "sinceRv", sinceRv, "sinceRvAge", sinceRvAge, "searchLookback", k.searchLookback)
	return latestEvent.ResourceVersion, k.listModifiedSinceEventStore(ctx, key, effectiveRv)
}

func convertEventType(action kv.DataAction) resourcepb.WatchEvent_Type {
	switch action {
	case DataActionCreated:
		return resourcepb.WatchEvent_ADDED
	case DataActionUpdated:
		return resourcepb.WatchEvent_MODIFIED
	case DataActionDeleted:
		return resourcepb.WatchEvent_DELETED
	default:
		panic(fmt.Sprintf("unknown DataAction: %v", action))
	}
}

func (k *kvStorageBackend) getValueFromDataStore(ctx context.Context, dataKey DataKey) ([]byte, error) {
	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.getValueFromDataStore")
	defer span.End()

	raw, err := k.dataStore.Get(ctx, dataKey)
	if err != nil {
		return []byte{}, err
	}

	value, err := io.ReadAll(raw)
	if err != nil {
		return []byte{}, err
	}

	return value, nil
}

func (k *kvStorageBackend) listModifiedSinceDataStore(ctx context.Context, key NamespacedResource, sinceRv int64) iter.Seq2[*ModifiedResource, error] {
	return func(yield func(*ModifiedResource, error) bool) {
		var lastSeenResource *ModifiedResource
		var lastSeenDataKey DataKey
		for dataKey, err := range k.dataStore.Keys(ctx, ListRequestKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource}, SortOrderAsc) {
			if err != nil {
				yield(&ModifiedResource{}, err)
				return
			}

			if dataKey.ResourceVersion < sinceRv {
				continue
			}

			if lastSeenResource == nil {
				lastSeenResource = &ModifiedResource{
					Key: resourcepb.ResourceKey{
						Namespace: dataKey.Namespace,
						Group:     dataKey.Group,
						Resource:  dataKey.Resource,
						Name:      dataKey.Name,
					},
					ResourceVersion: dataKey.ResourceVersion,
					Action:          convertEventType(dataKey.Action),
				}
				lastSeenDataKey = dataKey
			}

			if lastSeenResource.Key.Name != dataKey.Name {
				value, err := k.getValueFromDataStore(ctx, lastSeenDataKey)
				if err != nil {
					yield(&ModifiedResource{}, err)
					return
				}

				lastSeenResource.Value = value

				if !yield(lastSeenResource, nil) {
					return
				}
			}

			lastSeenResource = &ModifiedResource{
				Key: resourcepb.ResourceKey{
					Namespace: dataKey.Namespace,
					Group:     dataKey.Group,
					Resource:  dataKey.Resource,
					Name:      dataKey.Name,
				},
				ResourceVersion: dataKey.ResourceVersion,
				Action:          convertEventType(dataKey.Action),
			}
			lastSeenDataKey = dataKey
		}

		if lastSeenResource != nil {
			value, err := k.getValueFromDataStore(ctx, lastSeenDataKey)
			if err != nil {
				yield(&ModifiedResource{}, err)
				return
			}

			lastSeenResource.Value = value

			yield(lastSeenResource, nil)
		}
	}
}

func (k *kvStorageBackend) listModifiedSinceEventStore(ctx context.Context, key NamespacedResource, sinceRv int64) iter.Seq2[*ModifiedResource, error] {
	return func(yield func(*ModifiedResource, error) bool) {
		// we only care about the latest revision of every resource in the list
		seen := make(map[string]struct{})
		for evtKeyStr, err := range k.eventStore.ListKeysSince(ctx, sinceRv, SortOrderDesc) {
			if err != nil {
				yield(&ModifiedResource{}, err)
				return
			}

			evtKey, err := ParseEventKey(evtKeyStr)
			if err != nil {
				yield(&ModifiedResource{}, err)
				return
			}

			if evtKey.Group != key.Group || evtKey.Resource != key.Resource || evtKey.Namespace != key.Namespace {
				continue
			}

			if _, ok := seen[evtKey.Name]; ok {
				continue
			}

			seen[evtKey.Name] = struct{}{}
			value, err := k.getValueFromDataStore(ctx, DataKey(evtKey))
			if err != nil {
				yield(&ModifiedResource{}, err)
				return
			}

			if !yield(&ModifiedResource{
				Key: resourcepb.ResourceKey{
					Group:     evtKey.Group,
					Resource:  evtKey.Resource,
					Namespace: evtKey.Namespace,
					Name:      evtKey.Name,
				},
				Action:          convertEventType(evtKey.Action),
				ResourceVersion: evtKey.ResourceVersion,
				Value:           value,
			}, nil) {
				return
			}
		}
	}
}

// ListHistory is like ListIterator, but it returns the history of a resource.
func (k *kvStorageBackend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, fn func(ListIterator) error) (int64, error) {
	if err := validateListHistoryRequest(req); err != nil {
		return 0, err
	}
	key := req.Options.Key
	req.ResourceVersion = toSnowflakeRV(req.ResourceVersion)

	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.ListHistory", trace.WithAttributes(
		attribute.String("namespace", key.Namespace),
		attribute.String("group", key.Group),
		attribute.String("resource", key.Resource),
	))
	defer span.End()

	// Parse continue token if provided
	lastSeenRV := int64(0)
	if req.NextPageToken != "" {
		token, err := GetContinueToken(req.NextPageToken)
		if err != nil {
			return 0, fmt.Errorf("invalid continue token: %w", err)
		}
		lastSeenRV = toSnowflakeRV(token.ResourceVersion)
	}

	// Generate a new resource version for the list
	listRV := k.snowflake.Generate().Int64()

	// Handle trash differently from regular history
	if req.Source == resourcepb.ListRequest_TRASH {
		return k.processTrashEntries(ctx, req, fn, listRV, lastSeenRV)
	}

	// Get all history entries by iterating through datastore keys
	historyKeys := make([]DataKey, 0, min(defaultListBufferSize, req.Limit+1))

	// Use datastore.Keys to get all data keys for this specific resource
	for dataKey, err := range k.dataStore.Keys(ctx, ListRequestKey{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
		Name:      key.Name,
	}, SortOrderDesc) {
		if err != nil {
			return 0, err
		}
		historyKeys = append(historyKeys, dataKey)
	}

	// Check if context has been cancelled
	if ctx.Err() != nil {
		return 0, ctx.Err()
	}

	// Apply filtering based on version match
	filteredKeys, filterErr := filterHistoryKeysByVersion(historyKeys, req)
	if filterErr != nil {
		return 0, filterErr
	}

	// Apply "live" history logic: ignore events before the last delete
	filteredKeys = applyLiveHistoryFilter(filteredKeys, req)

	// Pagination: filter out items up to and including lastSeenRV
	pagedKeys := applyPagination(filteredKeys, lastSeenRV)

	iter := newKvHistoryIterator(ctx, k.dataStore, pagedKeys, listRV, false)
	defer iter.stop()

	if err := fn(iter); err != nil {
		return 0, err
	}

	return listRV, nil
}

// processTrashEntries handles the special case of listing deleted items (trash).
// It streams through keys in ascending order, tracking name groups. For each name,
// if the latest event is a delete, it's a trash candidate.
//
// The results are sorted by RV desc: the sorting in this case matters as it's
// the only convenient place to sort results by RV using the datastore before
// doing a BatchGet to fetch the resources. Existing user-facing features (such as
// Restore Dashboards) currently rely on this behaviour.
func (k *kvStorageBackend) processTrashEntries(
	ctx context.Context,
	req *resourcepb.ListRequest,
	fn func(ListIterator) error,
	listRV int64,
	lastSeenRV int64,
) (int64, error) {
	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.processTrashEntries")
	defer span.End()

	reqKey := req.Options.Key

	listKey := ListRequestKey{Group: reqKey.Group, Resource: reqKey.Resource, Namespace: reqKey.Namespace, Name: reqKey.Name}

	// Stream through keys, tracking name groups to find trash candidates
	candidates := make([]DataKey, 0, min(defaultListBufferSize, req.Limit+1))
	var currentName string
	var latestKey *DataKey

	processNameGroup := func() {
		if latestKey == nil {
			return
		}
		// Only include if the latest event for this name is a delete (i.e., resource is in trash)
		if latestKey.Action != DataActionDeleted {
			return
		}
		// Apply RV filtering
		if !matchesTrashVersionFilter(req, *latestKey) {
			return
		}
		candidates = append(candidates, *latestKey)
	}

	for dk, err := range k.dataStore.Keys(ctx, listKey, SortOrderAsc) {
		if err != nil {
			return 0, err
		}
		if ctx.Err() != nil {
			return 0, ctx.Err()
		}

		if dk.Name != currentName {
			// Name transitioned — process the previous group
			processNameGroup()
		}
		// Track the latest key for the current name (keys are in ASC order, so last one wins)
		currentName = dk.Name
		latestKey = &dk
	}
	// Process the final name group
	processNameGroup()

	// Sort candidates by resource version descending so the most recently
	// deleted items come first.
	slices.SortFunc(candidates, func(a, b DataKey) int {
		return cmp.Compare(b.ResourceVersion, a.ResourceVersion)
	})

	// Apply RV-based pagination: skip candidates already seen on previous pages.
	candidates = applyPagination(candidates, lastSeenRV)

	iter := newKvHistoryIterator(ctx, k.dataStore, candidates, listRV, true)
	defer iter.stop()

	if err := fn(iter); err != nil {
		return 0, err
	}

	return listRV, nil
}

// matchesTrashVersionFilter checks if a trash candidate passes the RV filter from the request.
func matchesTrashVersionFilter(req *resourcepb.ListRequest, key DataKey) bool {
	switch req.GetVersionMatchV2() {
	case resourcepb.ResourceVersionMatchV2_Exact:
		return key.ResourceVersion == req.ResourceVersion
	case resourcepb.ResourceVersionMatchV2_NotOlderThan:
		return req.ResourceVersion == 0 || key.ResourceVersion >= req.ResourceVersion
	default:
		// Unset/default: include if no RV filter or RV >= requested
		return req.ResourceVersion == 0 || key.ResourceVersion >= req.ResourceVersion
	}
}

// newKvHistoryIterator builds a kvHistoryIterator over dataStore.BatchGet(keys).
func newKvHistoryIterator(ctx context.Context, ds *dataStore, keys []DataKey, listRV int64, skipProvisioned bool) *kvHistoryIterator {
	return &kvHistoryIterator{
		listRV:          listRV,
		skipProvisioned: skipProvisioned,
		pull:            newBatchGetRetryPull(ctx, ds, keys),
	}
}

type kvHistoryIterator struct {
	listRV          int64
	skipProvisioned bool

	pull *batchGetRetryPull

	// current item state
	currentDataObj *DataObj
	value          []byte
	folder         string
	err            error
}

// stop closes the underlying pull. Callers should defer this.
func (i *kvHistoryIterator) stop() { i.pull.stop() }

func (i *kvHistoryIterator) Next() bool {
	for {
		dataObj, err, ok := i.pull.fetch()
		if !ok {
			return false
		}
		if err != nil {
			if i.shouldRetry(err) {
				continue
			}
			i.err = err
			return false
		}

		i.currentDataObj = &dataObj

		i.value, err = readAndClose(dataObj.Value)
		if err != nil {
			if i.shouldRetry(err) {
				continue
			}
			i.err = err
			return false
		}

		// Extract the folder from the meta data
		partial := &metav1.PartialObjectMetadata{}
		if err := json.Unmarshal(i.value, partial); err != nil {
			i.err = err
			return false
		}

		meta, err := utils.MetaAccessor(partial)
		if err != nil {
			i.err = err
			return false
		}
		i.folder = meta.GetFolder()

		// Success: advance past the yielded key
		i.pull.advance(dataObj.Key)

		// if the resource is provisioned and we are skipping provisioned resources, continue onto the next one
		if i.skipProvisioned && meta.GetAnnotation(utils.AnnoKeyManagerKind) != "" {
			continue
		}

		return true
	}
}

func (i *kvHistoryIterator) shouldRetry(err error) bool {
	canRetry, retryErr := i.pull.tryRetry(err)
	if retryErr != nil {
		i.err = retryErr
	}
	return canRetry
}

func (i *kvHistoryIterator) Error() error {
	return i.err
}

func (i *kvHistoryIterator) ContinueToken() string {
	if i.currentDataObj == nil {
		return ""
	}
	token := ContinueToken{
		Name:            i.currentDataObj.Key.Name,
		ResourceVersion: i.currentDataObj.Key.ResourceVersion,
	}
	return token.String()
}

func (i *kvHistoryIterator) ResourceVersion() int64 {
	if i.currentDataObj != nil {
		return i.currentDataObj.Key.ResourceVersion
	}
	return 0
}

func (i *kvHistoryIterator) Namespace() string {
	if i.currentDataObj != nil {
		return i.currentDataObj.Key.Namespace
	}
	return ""
}

func (i *kvHistoryIterator) Name() string {
	if i.currentDataObj != nil {
		return i.currentDataObj.Key.Name
	}
	return ""
}

func (i *kvHistoryIterator) Folder() string {
	return i.folder
}

func (i *kvHistoryIterator) Value() []byte {
	return i.value
}

// WatchWriteEvents returns a channel that receives write events.
func (k *kvStorageBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	// Create a channel to receive events
	events := make(chan *WrittenEvent, 10000) // TODO: make this configurable

	notifierEvents := k.notifier.Watch(ctx, k.watchOpts)
	go func() {
		for event := range notifierEvents {
			// fetch the data
			dataReader, err := k.dataStore.Get(ctx, DataKey{
				Group:           event.Group,
				Resource:        event.Resource,
				Namespace:       event.Namespace,
				Name:            event.Name,
				ResourceVersion: event.ResourceVersion,
				Action:          event.Action,
				Folder:          event.Folder,
			})
			if err != nil || dataReader == nil {
				k.log.Error("failed to get data for event", "error", err)
				continue
			}
			data, err := readAndClose(dataReader)
			if err != nil {
				k.log.Error("failed to read and close data for event", "error", err)
				continue
			}
			var t resourcepb.WatchEvent_Type
			switch event.Action {
			case DataActionCreated:
				t = resourcepb.WatchEvent_ADDED
			case DataActionUpdated:
				t = resourcepb.WatchEvent_MODIFIED
			case DataActionDeleted:
				t = resourcepb.WatchEvent_DELETED
			}

			events <- &WrittenEvent{
				Key: &resourcepb.ResourceKey{
					Namespace: event.Namespace,
					Group:     event.Group,
					Resource:  event.Resource,
					Name:      event.Name,
				},
				Type:            t,
				Folder:          event.Folder,
				Value:           data,
				ResourceVersion: event.ResourceVersion,
				PreviousRV:      event.PreviousRV,
				Timestamp:       resourceVersionTime(event.ResourceVersion).Unix(),
			}
		}
		close(events)
	}()
	return events, nil
}

// GetResourceStats returns resource stats within the storage backend.
func (k *kvStorageBackend) GetResourceStats(ctx context.Context, nsr NamespacedResource, minCount int) ([]ResourceStats, error) {
	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.GetResourceStats", trace.WithAttributes(
		attribute.String("namespace", nsr.Namespace),
		attribute.String("group", nsr.Group),
		attribute.String("resource", nsr.Resource),
	))
	defer span.End()

	return k.dataStore.GetResourceStats(ctx, nsr, minCount)
}

func (k *kvStorageBackend) GetResourceLastImportTimes(ctx context.Context) iter.Seq2[ResourceLastImportTime, error] {
	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.GetResourceLastImportTimes")

	return func(yield func(ResourceLastImportTime, error) bool) {
		defer span.End()
		valid, _, err := k.lastImportStore.ListLastImportTimes(ctx, k.lastImportTimeMaxAge)
		if err != nil {
			yield(ResourceLastImportTime{}, err)
			return
		}
		for _, v := range valid {
			if !yield(v.ToResourceLastImportTime(), nil) {
				return
			}
		}
	}
}

type kvBulkImportItem struct {
	req        *resourcepb.BulkRequest
	dataKey    DataKey
	nameKey    string
	microRV    int64
	previousRV int64
	generation int64
}

type singleBulkRequestBatchIterator struct {
	iter  BulkRequestIterator
	batch []*resourcepb.BulkRequest
}

func (s *singleBulkRequestBatchIterator) NextBatch() bool {
	if !s.iter.Next() {
		return false
	}

	req := s.iter.Request()
	if req == nil {
		s.batch = nil
		return true
	}

	s.batch = []*resourcepb.BulkRequest{req}
	return true
}

func (s *singleBulkRequestBatchIterator) Batch() []*resourcepb.BulkRequest {
	return s.batch
}

func (s *singleBulkRequestBatchIterator) RollbackRequested() bool {
	return s.iter.RollbackRequested()
}

//nolint:gocyclo
func (b *kvStorageBackend) ProcessBulk(ctx context.Context, setting BulkSettings, iter BulkRequestIterator) *resourcepb.BulkResponse {
	ctx, span := tracer.Start(ctx, "resource.kvStorageBackend.ProcessBulk")
	defer span.End()

	// rvManagerDB is the database handle for rvManager and legacy compat operations.
	// During SQLite migrations it's swapped to the migration's tx to avoid SQLITE_BUSY.
	var rvManagerDB db.ContextExecer
	var usingMigrationTx bool
	if b.rvManager != nil {
		rvManagerDB = b.rvManager.DB()
	}
	if clientCtx := inprocgrpc.ClientContext(ctx); clientCtx != nil {
		if externalTx := TransactionFromContext(clientCtx); externalTx != nil {
			ctx = kv.ContextWithDBTX(ctx, externalTx)
			if rvManagerDB != nil {
				rvManagerDB = dbimpl.NewTx(externalTx)
				usingMigrationTx = true
			}
		}
	}

	// TODO cross-node lock
	err := b.bulkLock.Start(setting.Collection)
	if err != nil {
		return &resourcepb.BulkResponse{
			Error: AsErrorResult(err),
		}
	}
	defer b.bulkLock.Finish(setting.Collection)

	bulkRvGenerator := newBulkRV()
	summaries := make(map[string]*resourcepb.BulkResponse_Summary, len(setting.Collection))
	rsp := &resourcepb.BulkResponse{}

	reportError := func(err error, format string, args ...any) {
		msg := fmt.Sprintf(format, args...)
		b.log.Error(msg, "error", err)
		rsp.Error = AsErrorResult(fmt.Errorf("%s: %w", msg, err))
	}

	for _, key := range setting.Collection {
		events := make([]string, 0)
		for evtKeyStr, err := range b.eventStore.ListKeysSince(ctx, 1, SortOrderAsc) {
			if err != nil {
				reportError(err, "failed to list event")
				return rsp
			}

			evtKey, err := ParseEventKey(evtKeyStr)
			if err != nil {
				reportError(err, "error parsing event key")
				return rsp
			}

			if evtKey.Group != key.Group || evtKey.Resource != key.Resource || evtKey.Namespace != key.Namespace {
				continue
			}

			events = append(events, evtKeyStr)
		}

		if err := b.eventStore.batchDelete(ctx, events); err != nil {
			reportError(err, "failed to delete events")
			return rsp
		}

		historyKeys := make([]DataKey, 0)

		for dataKey, err := range b.dataStore.Keys(ctx, ListRequestKey{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
		}, SortOrderAsc) {
			if err != nil {
				reportError(err, "failed to list collection before delete")
				return rsp
			}

			historyKeys = append(historyKeys, dataKey)
		}

		previousCount := int64(len(historyKeys))
		if err := b.dataStore.batchDelete(ctx, historyKeys); err != nil {
			reportError(err, "failed to delete collection")
			return rsp
		}

		// Delete legacy resource rows for this collection so they can be re-synced after import.
		if rvManagerDB != nil {
			if err := b.dataStore.deleteLegacyResourceCollection(ctx, rvManagerDB, key.Namespace, key.Group, key.Resource); err != nil {
				reportError(err, "failed to delete legacy resource collection")
				return rsp
			}
		}

		summary := &resourcepb.BulkResponse_Summary{
			Namespace:     key.Namespace,
			Group:         key.Group,
			Resource:      key.Resource,
			PreviousCount: previousCount,
		}
		summaries[NSGR(key)] = summary
		rsp.Summary = append(rsp.Summary, summary)
	}

	saved := make([]DataKey, 0)
	rollback := func() {
		// we don't have transactions in the kv store, so we simply delete everything we created
		err = b.dataStore.batchDelete(ctx, saved)
		if err != nil {
			b.log.Error("failed to delete during rollback: %s", err)
		}
	}

	updatedResources := make(map[NamespacedResource]bool)
	// Track the last micro RV per resource name for computing previous_resource_version in compat mode.
	lastMicroRV := make(map[string]int64)
	recordSavedItem := func(item kvBulkImportItem) {
		saved = append(saved, item.dataKey)
		updatedResources[NamespacedResource{
			Namespace: item.dataKey.Namespace,
			Group:     item.dataKey.Group,
			Resource:  item.dataKey.Resource,
		}] = true
		nsgr := NSGR(&resourcepb.ResourceKey{
			Namespace: item.dataKey.Namespace,
			Group:     item.dataKey.Group,
			Resource:  item.dataKey.Resource,
		})
		if summary, ok := summaries[nsgr]; ok {
			summary.Count++
		}
	}

	batchIter, ok := iter.(BulkRequestBatchIterator)
	if !ok {
		batchIter = &singleBulkRequestBatchIterator{iter: iter}
	}

	for batchIter.NextBatch() {
		if batchIter.RollbackRequested() {
			rollback()
			break
		}

		batch := batchIter.Batch()
		if len(batch) == 0 {
			rollback()
			rsp.Error = AsErrorResult(fmt.Errorf("missing request batch"))
			return rsp
		}

		batchItems := make([]kvBulkImportItem, 0, len(batch))
		batchRows := make([]kv.DataImportRow, 0, len(batch))
		batchLastMicroRV := lastMicroRV
		if rvManagerDB != nil {
			batchLastMicroRV = make(map[string]int64, len(lastMicroRV)+len(batch))
			for key, value := range lastMicroRV {
				batchLastMicroRV[key] = value
			}
		}

		for _, req := range batch {
			if req == nil {
				rollback()
				rsp.Error = AsErrorResult(fmt.Errorf("missing request"))
				return rsp
			}

			rsp.Processed++

			var action kv.DataAction
			switch resourcepb.WatchEvent_Type(req.Action) {
			case resourcepb.WatchEvent_ADDED:
				action = DataActionCreated
			case resourcepb.WatchEvent_MODIFIED:
				action = DataActionUpdated
			case resourcepb.WatchEvent_DELETED:
				action = DataActionDeleted
			default:
				rsp.Rejected = append(rsp.Rejected, &resourcepb.BulkResponse_Rejected{
					Key:    req.Key,
					Action: req.Action,
					Error:  "invalid event type",
				})
				continue
			}

			obj := &unstructured.Unstructured{}
			err := obj.UnmarshalJSON(req.Value)
			if err != nil {
				rsp.Rejected = append(rsp.Rejected, &resourcepb.BulkResponse_Rejected{
					Key:    req.Key,
					Action: req.Action,
					Error:  "unable to unmarshal json",
				})
				continue
			}

			dataKey := DataKey{
				Group:           req.Key.Group,
				Resource:        req.Key.Resource,
				Namespace:       req.Key.Namespace,
				Name:            req.Key.Name,
				ResourceVersion: bulkRvGenerator.next(obj),
				Action:          action,
				Folder:          req.Folder,
			}

			if err := validateDataKey(dataKey); err != nil {
				rsp.Rejected = append(rsp.Rejected, &resourcepb.BulkResponse_Rejected{
					Key:    req.Key,
					Action: req.Action,
					Error:  fmt.Sprintf("failed to save resource: invalid data key: %s", err),
				})
				continue
			}

			item := kvBulkImportItem{
				req:     req,
				dataKey: dataKey,
			}

			if rvManagerDB != nil {
				item.microRV = rvmanager.RVFromSnowflake(dataKey.ResourceVersion)
				item.generation = obj.GetGeneration()
				if action == DataActionDeleted {
					item.generation = 0
				}

				nameKey := dataKey.Group + "/" + dataKey.Resource + "/" + dataKey.Namespace + "/" + dataKey.Name
				item.nameKey = nameKey
				if action != DataActionCreated {
					item.previousRV = batchLastMicroRV[nameKey]
				}
				batchLastMicroRV[nameKey] = item.microRV
			}

			batchItems = append(batchItems, item)
			importRow := kv.DataImportRow{
				GUID:    uuid.New().String(),
				KeyPath: kv.DataSection + "/" + dataKey.String(),
				Value:   req.Value,
			}
			if rvManagerDB != nil {
				legacyAction, err := kv.LegacyActionValue(action)
				if err != nil {
					rollback()
					rsp.Error = AsErrorResult(fmt.Errorf("failed to map legacy action: %w", err))
					return rsp
				}
				importRow.Legacy = &kv.DataImportLegacyFields{
					Group:           dataKey.Group,
					Resource:        dataKey.Resource,
					Namespace:       dataKey.Namespace,
					Name:            dataKey.Name,
					Action:          legacyAction,
					Folder:          dataKey.Folder,
					ResourceVersion: item.microRV,
					PreviousRV:      item.previousRV,
					Generation:      item.generation,
				}
			}
			batchRows = append(batchRows, importRow)
		}

		usedBatchWriter, err := b.dataStore.insertDataImportBatch(ctx, batchRows)
		if err != nil {
			rollback()
			rsp.Error = AsErrorResult(fmt.Errorf("failed to save resource batch: %w", err))
			return rsp
		}

		if !usedBatchWriter {
			for _, item := range batchItems {
				err := b.dataStore.Save(ctx, item.dataKey, bytes.NewReader(item.req.Value))
				if err != nil {
					rsp.Rejected = append(rsp.Rejected, &resourcepb.BulkResponse_Rejected{
						Key:    item.req.Key,
						Action: item.req.Action,
						Error:  fmt.Sprintf("failed to save resource: %s", err),
					})
					continue
				}

				recordSavedItem(item)
				if item.nameKey != "" {
					lastMicroRV[item.nameKey] = item.microRV
				}
			}
			continue
		}

		for _, item := range batchItems {
			recordSavedItem(item)
			if item.nameKey != "" {
				lastMicroRV[item.nameKey] = item.microRV
			}
		}
	}

	// Sync legacy resource table and bump RV counter for each collection.
	if rvManagerDB != nil && rsp.Error == nil {
		// Check whether we're using the migration tx (no ExecWithRV — it uses its own connection).
		for _, key := range setting.Collection {
			if err := b.dataStore.syncLegacyResourceFromHistory(ctx, rvManagerDB, key.Namespace, key.Group, key.Resource); err != nil {
				reportError(err, "failed to sync legacy resource from history")
				return rsp
			}

			// Bump the RV counter so subsequent WriteEvent calls generate RVs above the bulk-imported ones.
			// Without this, ExecWithRV could produce colliding or lower RVs. Same pattern as SQL backend's ProcessBulk.
			if usingMigrationTx {
				// On SQLite, Lock+SaveRV through the migration tx (same as SQL backend).
				// ExecWithRV would deadlock because it opens its own connection.
				nextRV, err := b.rvManager.Lock(ctx, rvManagerDB, key.Group, key.Resource)
				if err != nil {
					b.log.Warn("error locking RV", "error", err, "key", NSGR(key))
				} else {
					if err := b.rvManager.SaveRV(ctx, rvManagerDB, key.Group, key.Resource, nextRV); err != nil {
						b.log.Warn("error saving RV", "error", err, "key", NSGR(key))
					}
				}
			} else {
				_, err := b.rvManager.ExecWithRV(ctx, key, func(_ context.Context, _ db.Tx) (string, error) {
					return "", nil
				})
				if err != nil {
					b.log.Warn("error increasing RV for bulk", "error", err)
				}
			}
		}
	}

	if rsp.Error == nil {
		now := time.Now()
		for nsr := range updatedResources {
			err := b.lastImportStore.Save(ctx, ResourceLastImportTime{
				NamespacedResource: nsr,
				LastImportTime:     now,
			})
			if err != nil {
				reportError(err, "failed to save last import time for resource %s", nsr.String())
			}
		}
	}

	return rsp
}

// readAndClose reads all data from a ReadCloser and ensures it's closed,
// combining any errors from both operations.
func readAndClose(r io.ReadCloser) ([]byte, error) {
	data, err := io.ReadAll(r)
	return data, errors.Join(err, r.Close())
}
