package sql

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/util/debouncer"
	"github.com/grafana/grafana/pkg/util/sqlite"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// storageBackendImpl implements resource.StorageWriter and resource.StorageWatcher.
// It embeds baseBackend to get StorageReader capabilities.
type storageBackendImpl struct {
	*baseBackend // Embed base (provides StorageReader)

	// resource version manager (only needed for write operations)
	rvManager *rvmanager.ResourceVersionManager

	// watch streaming
	pollingInterval time.Duration
	watchBufferSize int
	notifier        eventNotifier
	isHA            bool

	// write helpers
	bulkLock *bulkLock

	// history management
	historyPruner     resource.Pruner
	garbageCollection GarbageCollectionConfig

	// testing
	simulatedNetworkLatency time.Duration
}

// storageBackendOptions contains options for creating a storageBackendImpl.
type storageBackendOptions struct {
	DBProvider              db.DBProvider
	Reg                     prometheus.Registerer
	StorageMetrics          *resource.StorageMetrics
	PollingInterval         time.Duration
	WatchBufferSize         int
	IsHA                    bool
	GarbageCollection       GarbageCollectionConfig
	SimulatedNetworkLatency time.Duration
}

// newStorageBackendWithBase creates a storage backend using a pre-existing base backend.
// This is useful when composing multiple backend types that share the same base.
func newStorageBackendWithBase(base *baseBackend, opts storageBackendOptions) (*storageBackendImpl, error) {
	pollingInterval := opts.PollingInterval
	if pollingInterval == 0 {
		pollingInterval = defaultPollingInterval
	}
	watchBufferSize := opts.WatchBufferSize
	if watchBufferSize == 0 {
		watchBufferSize = defaultWatchBufferSize
	}

	return &storageBackendImpl{
		baseBackend:             base,
		isHA:                    opts.IsHA,
		pollingInterval:         pollingInterval,
		watchBufferSize:         watchBufferSize,
		bulkLock:                &bulkLock{running: make(map[string]bool)},
		simulatedNetworkLatency: opts.SimulatedNetworkLatency,
		garbageCollection:       opts.GarbageCollection,
	}, nil
}

// Init initializes the storage backend (base init + rvManager + notifier + pruner + GC).
func (b *storageBackendImpl) Init(ctx context.Context) error {
	// Initialize ResourceVersionManager (only needed for storage/write operations)
	rvMgr, err := rvmanager.NewResourceVersionManager(rvmanager.ResourceManagerOptions{
		Dialect: b.dialect,
		DB:      b.db,
	})
	if err != nil {
		return fmt.Errorf("failed to create resource version manager: %w", err)
	}
	b.rvManager = rvMgr

	// Initialize notifier after dialect is set up
	notifier, err := newNotifier(&notifierConfig{
		isHA:            b.isHA,
		pollingInterval: b.pollingInterval,
		watchBufferSize: b.watchBufferSize,
		log:             b.log,
		bulkLock:        b.bulkLock,
		listLatestRVs:   b.listLatestRVs,
		storageMetrics:  b.storageMetrics,
		done:            b.done,
		db:              b.db,
		dialect:         b.dialect,
	})
	if err != nil {
		return fmt.Errorf("failed to create notifier: %w", err)
	}
	b.notifier = notifier

	if err := b.initPruner(ctx); err != nil {
		return fmt.Errorf("failed to create pruner: %w", err)
	}
	if b.garbageCollection.Enabled {
		if err := b.initGarbageCollection(ctx); err != nil {
			return fmt.Errorf("failed to initialize garbage collection: %w", err)
		}
	}

	return nil
}

// WriteEvent implements resource.StorageWriter.
func (b *storageBackendImpl) WriteEvent(ctx context.Context, event resource.WriteEvent) (int64, error) {
	_, span := tracer.Start(ctx, "sql.backend.WriteEvent")
	defer span.End()

	switch event.Type {
	case resourcepb.WatchEvent_ADDED:
		return b.create(ctx, event)
	case resourcepb.WatchEvent_MODIFIED:
		return b.update(ctx, event)
	case resourcepb.WatchEvent_DELETED:
		return b.delete(ctx, event)
	default:
		return 0, fmt.Errorf("unsupported event type")
	}
}

func (b *storageBackendImpl) create(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.create")
	defer span.End()

	folder := ""
	if event.Object != nil {
		folder = event.Object.GetFolder()
	}

	rv, err := b.rvManager.ExecWithRV(ctx, event.Key, func(tx db.Tx) (string, error) {
		// 1. Insert into resource
		if _, err := dbutil.Exec(ctx, tx, sqlResourceInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			GUID:        event.GUID,
		}); err != nil {
			if IsRowAlreadyExistsError(err) {
				return event.GUID, resource.ErrResourceAlreadyExists
			}
			return event.GUID, fmt.Errorf("insert into resource: %w", err)
		}

		// 2. Insert into resource history
		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			Generation:  event.Object.GetGeneration(),
			GUID:        event.GUID,
		}); err != nil {
			return event.GUID, fmt.Errorf("insert into resource history: %w", err)
		}
		_ = b.historyPruner.Add(resource.PruningKey{
			Namespace: event.Key.Namespace,
			Group:     event.Key.Group,
			Resource:  event.Key.Resource,
			Name:      event.Key.Name,
		})
		if b.simulatedNetworkLatency > 0 {
			time.Sleep(b.simulatedNetworkLatency)
		}
		return event.GUID, nil
	})

	if err != nil {
		return 0, err
	}

	b.notifier.send(ctx, &resource.WrittenEvent{
		Type:            event.Type,
		Key:             event.Key,
		PreviousRV:      event.PreviousRV,
		Value:           event.Value,
		ResourceVersion: rv,
		Folder:          folder,
	})

	return rv, nil
}

func (b *storageBackendImpl) update(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.update")
	defer span.End()

	folder := ""
	if event.Object != nil {
		folder = event.Object.GetFolder()
	}

	// Use rvManager.ExecWithRV instead of direct transaction
	rv, err := b.rvManager.ExecWithRV(ctx, event.Key, func(tx db.Tx) (string, error) {
		// 1. Update resource
		res, err := dbutil.Exec(ctx, tx, sqlResourceUpdate, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event, // includes the RV
			Folder:      folder,
			GUID:        event.GUID,
		})
		if err != nil {
			return event.GUID, fmt.Errorf("resource update: %w", err)
		}
		if err = b.checkConflict(res, event.Key, event.PreviousRV); err != nil {
			return event.GUID, err
		}

		// 2. Insert into resource history
		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			GUID:        event.GUID,
			Generation:  event.Object.GetGeneration(),
		}); err != nil {
			return event.GUID, fmt.Errorf("insert into resource history: %w", err)
		}
		_ = b.historyPruner.Add(resource.PruningKey{
			Namespace: event.Key.Namespace,
			Group:     event.Key.Group,
			Resource:  event.Key.Resource,
			Name:      event.Key.Name,
		})
		return event.GUID, nil
	})

	if err != nil {
		return 0, err
	}

	b.notifier.send(ctx, &resource.WrittenEvent{
		Type:            event.Type,
		Key:             event.Key,
		PreviousRV:      event.PreviousRV,
		Value:           event.Value,
		ResourceVersion: rv,
		Folder:          folder,
	})

	return rv, nil
}

func (b *storageBackendImpl) delete(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.delete")
	defer span.End()

	folder := ""
	if event.Object != nil {
		folder = event.Object.GetFolder()
	}
	rv, err := b.rvManager.ExecWithRV(ctx, event.Key, func(tx db.Tx) (string, error) {
		// 1. delete from resource
		res, err := dbutil.Exec(ctx, tx, sqlResourceDelete, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			GUID:        event.GUID,
		})
		if err != nil {
			return event.GUID, fmt.Errorf("delete resource: %w", err)
		}
		if err = b.checkConflict(res, event.Key, event.PreviousRV); err != nil {
			return event.GUID, err
		}

		// 2. Add event to resource history
		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			GUID:        event.GUID,
			Generation:  0, // object does not exist
		}); err != nil {
			return event.GUID, fmt.Errorf("insert into resource history: %w", err)
		}
		_ = b.historyPruner.Add(resource.PruningKey{
			Namespace: event.Key.Namespace,
			Group:     event.Key.Group,
			Resource:  event.Key.Resource,
			Name:      event.Key.Name,
		})
		return event.GUID, nil
	})

	if err != nil {
		return 0, err
	}

	b.notifier.send(ctx, &resource.WrittenEvent{
		Type:            event.Type,
		Key:             event.Key,
		PreviousRV:      event.PreviousRV,
		Value:           event.Value,
		ResourceVersion: rv,
		Folder:          folder,
	})

	return rv, nil
}

func (b *storageBackendImpl) checkConflict(res db.Result, key *resourcepb.ResourceKey, rv int64) error {
	if rv == 0 {
		return nil
	}

	// The RV is part of the update request, and it may no longer be the most recent
	rows, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("unable to verify RV: %w", err)
	}
	if rows == 1 {
		return nil // expected one result
	}
	if rows > 0 {
		return fmt.Errorf("multiple rows effected (%d)", rows)
	}
	return apierrors.NewConflict(schema.GroupResource{
		Group:    key.Group,
		Resource: key.Resource,
	}, key.Name, fmt.Errorf("resource version does not match current value"))
}

// WatchWriteEvents implements resource.StorageWatcher.
func (b *storageBackendImpl) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	return b.notifier.notify(ctx)
}

// IsRowAlreadyExistsError checks if the error is the result of the row inserted already existing.
func IsRowAlreadyExistsError(err error) bool {
	if sqlite.IsUniqueConstraintViolation(err) {
		return true
	}

	var pg *pgconn.PgError
	if errors.As(err, &pg) {
		// https://www.postgresql.org/docs/current/errcodes-appendix.html
		return pg.Code == "23505" // unique_violation
	}

	var pqerr *pq.Error
	if errors.As(err, &pqerr) {
		// https://www.postgresql.org/docs/current/errcodes-appendix.html
		return pqerr.Code == "23505" // unique_violation
	}

	var mysqlerr *mysql.MySQLError
	if errors.As(err, &mysqlerr) {
		// https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html
		return mysqlerr.Number == 1062 // ER_DUP_ENTRY
	}

	return false
}

func (b *storageBackendImpl) initPruner(ctx context.Context) error {
	b.log.Debug("using debounced history pruner")
	// Initialize history pruner.
	pruner, err := debouncer.NewGroup(debouncer.DebouncerOpts[resource.PruningKey]{
		Name:       "history_pruner",
		BufferSize: 1000,
		MinWait:    time.Second * 30,
		MaxWait:    time.Minute * 5,
		ProcessHandler: func(ctx context.Context, key resource.PruningKey) error {
			return b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
				res, err := dbutil.Exec(ctx, tx, sqlResourceHistoryPrune, &sqlPruneHistoryRequest{
					SQLTemplate:  sqltemplate.New(b.dialect),
					HistoryLimit: defaultPrunerHistoryLimit,
					Key: &resourcepb.ResourceKey{
						Namespace: key.Namespace,
						Group:     key.Group,
						Resource:  key.Resource,
						Name:      key.Name,
					},
				})
				if err != nil {
					return fmt.Errorf("failed to prune history: %w", err)
				}
				rows, err := res.RowsAffected()
				if err != nil {
					return fmt.Errorf("failed to get rows affected: %w", err)
				}
				b.log.Debug("pruned history successfully",
					"namespace", key.Namespace,
					"group", key.Group,
					"resource", key.Resource,
					"name", key.Name,
					"rows", rows)
				return nil
			})
		},
		ErrorHandler: func(key resource.PruningKey, err error) {
			b.log.Error("failed to prune history",
				"namespace", key.Namespace,
				"group", key.Group,
				"resource", key.Resource,
				"name", key.Name,
				"error", err)
		},
		Reg: b.reg,
	})
	if err != nil {
		return err
	}

	b.historyPruner = pruner
	b.historyPruner.Start(ctx)
	return nil
}

func (b *storageBackendImpl) initGarbageCollection(ctx context.Context) error {
	b.log.Info("starting garbage collection loop")

	go func() {
		// delay the first run by a random amount between 0 and the interval to avoid thundering herd
		if b.garbageCollection.Interval > 0 {
			jitter := time.Duration(rand.Int63n(b.garbageCollection.Interval.Nanoseconds()))
			select {
			case <-b.done:
				return
			case <-time.After(jitter):
			}
		}

		ticker := time.NewTicker(b.garbageCollection.Interval)
		defer ticker.Stop()

		for {
			select {
			case <-b.done:
				return
			case <-ticker.C:
				_ = b.runGarbageCollection(ctx, time.Now().Add(-b.garbageCollection.MaxAge).UnixMicro())
			}
		}
	}()

	return nil
}

func (b *storageBackendImpl) runGarbageCollection(ctx context.Context, cutoffTimeStamp int64) map[string]int64 {
	ctx, span := tracer.Start(ctx, "sql.backend.runGarbageCollection")
	defer span.End()
	start := time.Now()

	deletedByKey := map[string]int64{}

	groupResources, err := b.listLatestRVs(ctx)
	if err != nil {
		b.log.Error("failed to list group resources for garbage collection", "error", err)
		return deletedByKey
	}

	for group, resources := range groupResources {
		for resourceName := range resources {
			resourceKey := group + "/" + resourceName
			resourceCutoff := b.garbageCollectionCutoffTimestamp(group, resourceName, cutoffTimeStamp)
			totalDeleted := int64(0)
			for {
				deleted, err := b.garbageCollectBatch(ctx, group, resourceName, resourceCutoff, b.garbageCollection.BatchSize)
				if err != nil {
					b.log.Error("garbage collection failed",
						"group", group,
						"resource", resourceName,
						"error", err)
					break
				}
				if deleted == 0 {
					break
				}
				totalDeleted += deleted
				if deleted < int64(b.garbageCollection.BatchSize) {
					break
				}
				select {
				case <-b.done:
					return deletedByKey
				case <-time.After(time.Second):
				}
			}
			if totalDeleted > 0 {
				b.log.Info("garbage collection deleted history",
					"group", group,
					"resource", resourceName,
					"rows", totalDeleted,
					"seconds", time.Since(start).Seconds(),
				)
				deletedByKey[resourceKey] += totalDeleted
			}
		}
	}

	return deletedByKey
}

func (b *storageBackendImpl) garbageCollectionCutoffTimestamp(group, resourceName string, defaultCutoff int64) int64 {
	if group == "dashboard.grafana.app" && resourceName == "dashboards" {
		return time.Now().Add(-b.garbageCollection.DashboardsMaxAge).UnixMicro()
	}
	return defaultCutoff
}

func (b *storageBackendImpl) garbageCollectBatch(ctx context.Context, group, resourceName string, cutoffTimestamp int64, batchSize int) (int64, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.garbageCollectBatch")
	span.SetAttributes(attribute.String("group", group), attribute.String("resource", resourceName), attribute.Int64("cutoffTimestamp", cutoffTimestamp), attribute.Int("batchSize", batchSize))
	defer span.End()

	var rowsAffected int64
	err := b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		// query will return at most batchSize candidates
		candidates, err := dbutil.Query(ctx, tx, sqlResourceHistoryGarbageGetCandidates, &sqlGarbageCollectCandidatesRequest{
			SQLTemplate:     sqltemplate.New(b.dialect),
			Group:           group,
			Resource:        resourceName,
			CutoffTimestamp: cutoffTimestamp,
			BatchSize:       batchSize,
			Response:        new(gcCandidateName),
		})
		if err != nil {
			return err
		}
		if len(candidates) == 0 {
			return nil
		}
		span.AddEvent("candidates", trace.WithAttributes(attribute.Int("candidates", len(candidates))))
		res, err := dbutil.Exec(ctx, tx, sqlResourceHistoryGCDeleteByNames, &sqlGarbageCollectDeleteByNamesRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Group:       group,
			Resource:    resourceName,
			Candidates:  candidates,
		})
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}
		rowsAffected = rows
		span.AddEvent("rows deleted", trace.WithAttributes(attribute.Int64("rowsDeleted", rowsAffected)))
		return nil
	})
	return rowsAffected, err
}

// listLatestRVs returns the latest resource version for each (Group, Resource) pair.
func (b *storageBackendImpl) listLatestRVs(ctx context.Context) (groupResourceRV, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.listLatestRVs")
	defer span.End()
	var grvs []*groupResourceVersion
	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		var err error
		grvs, err = dbutil.Query(ctx, tx, sqlResourceVersionList, &sqlResourceVersionListRequest{
			SQLTemplate:          sqltemplate.New(b.dialect),
			groupResourceVersion: new(groupResourceVersion),
		})

		return err
	})
	if err != nil {
		return nil, err
	}

	since := groupResourceRV{}
	for _, grv := range grvs {
		if since[grv.Group] == nil {
			since[grv.Group] = map[string]int64{}
		}
		since[grv.Group][grv.Resource] = grv.ResourceVersion
	}

	return since, nil
}
