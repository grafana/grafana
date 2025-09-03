package sql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"iter"
	"math"
	"sync"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/protobuf/proto"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/util/sqlite"

	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/util/debouncer"
)

const tracePrefix = "sql.resource."
const defaultPollingInterval = 100 * time.Millisecond
const defaultWatchBufferSize = 100 // number of events to buffer in the watch stream
const defaultPrunerHistoryLimit = 20

type Backend interface {
	resource.StorageBackend
	resourcepb.DiagnosticsServer
	resource.LifecycleHooks
}

type BackendOptions struct {
	DBProvider      db.DBProvider
	Tracer          trace.Tracer
	Reg             prometheus.Registerer
	PollingInterval time.Duration
	WatchBufferSize int
	IsHA            bool
	storageMetrics  *resource.StorageMetrics

	// If true, the backend will prune history on write events.
	// Will be removed once fully rolled out.
	withPruner bool

	// testing
	SimulatedNetworkLatency time.Duration // slows down the create transactions by a fixed amount
}

func NewBackend(opts BackendOptions) (Backend, error) {
	if opts.DBProvider == nil {
		return nil, errors.New("no db provider")
	}
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("sql-backend")
	}
	ctx, cancel := context.WithCancel(context.Background())

	if opts.PollingInterval == 0 {
		opts.PollingInterval = defaultPollingInterval
	}
	if opts.WatchBufferSize == 0 {
		opts.WatchBufferSize = defaultWatchBufferSize
	}
	return &backend{
		isHA:                    opts.IsHA,
		done:                    ctx.Done(),
		cancel:                  cancel,
		log:                     logging.DefaultLogger.With("logger", "sql-resource-server"),
		tracer:                  opts.Tracer,
		reg:                     opts.Reg,
		dbProvider:              opts.DBProvider,
		pollingInterval:         opts.PollingInterval,
		watchBufferSize:         opts.WatchBufferSize,
		storageMetrics:          opts.storageMetrics,
		bulkLock:                &bulkLock{running: make(map[string]bool)},
		simulatedNetworkLatency: opts.SimulatedNetworkLatency,
		withPruner:              opts.withPruner,
	}, nil
}

type backend struct {
	//general
	isHA bool

	// server lifecycle
	done     <-chan struct{}
	cancel   context.CancelFunc
	initOnce sync.Once
	initErr  error

	// o11y
	log            logging.Logger
	tracer         trace.Tracer
	reg            prometheus.Registerer
	storageMetrics *resource.StorageMetrics

	// database
	dbProvider db.DBProvider
	db         db.DB
	dialect    sqltemplate.Dialect
	bulkLock   *bulkLock

	// watch streaming
	//stream chan *resource.WatchEvent
	pollingInterval time.Duration
	watchBufferSize int
	notifier        eventNotifier

	// resource version manager
	rvManager *resourceVersionManager

	// testing
	simulatedNetworkLatency time.Duration

	historyPruner resource.Pruner
	withPruner    bool
}

func (b *backend) Init(ctx context.Context) error {
	b.initOnce.Do(func() {
		b.initErr = b.initLocked(ctx)
	})
	return b.initErr
}

func (b *backend) initLocked(ctx context.Context) error {
	dbConn, err := b.dbProvider.Init(ctx)
	if err != nil {
		return fmt.Errorf("initialize resource DB: %w", err)
	}

	if err := dbConn.PingContext(ctx); err != nil {
		return fmt.Errorf("ping resource DB: %w", err)
	}

	b.db = dbConn

	driverName := dbConn.DriverName()
	b.dialect = sqltemplate.DialectForDriver(driverName)
	if b.dialect == nil {
		return fmt.Errorf("no dialect for driver %q", driverName)
	}

	// Initialize ResourceVersionManager
	rvManager, err := NewResourceVersionManager(ResourceManagerOptions{
		Dialect: b.dialect,
		DB:      b.db,
		Tracer:  b.tracer,
	})
	if err != nil {
		return fmt.Errorf("failed to create resource version manager: %w", err)
	}
	b.rvManager = rvManager

	// Initialize notifier after dialect is set up
	notifier, err := newNotifier(b)
	if err != nil {
		return fmt.Errorf("failed to create notifier: %w", err)
	}
	b.notifier = notifier

	if err := b.initPruner(ctx); err != nil {
		return fmt.Errorf("failed to create pruner: %w", err)
	}

	return nil
}

func (b *backend) initPruner(ctx context.Context) error {
	if !b.withPruner {
		b.log.Debug("using noop history pruner")
		b.historyPruner = &noopPruner{}
		return nil
	}
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

func (b *backend) IsHealthy(ctx context.Context, _ *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	// ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "isHealthy"}))

	if err := b.db.PingContext(ctx); err != nil {
		return nil, err
	}

	return &resourcepb.HealthCheckResponse{Status: resourcepb.HealthCheckResponse_SERVING}, nil
}

func (b *backend) Stop(_ context.Context) error {
	b.cancel()
	return nil
}

// GetResourceStats implements Backend.
func (b *backend) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]resource.ResourceStats, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"GetResourceStats")
	defer span.End()

	req := &sqlStatsRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   namespace,
		MinCount:    minCount, // not used in query... yet?
	}

	res := make([]resource.ResourceStats, 0, 100)
	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		rows, err := dbutil.QueryRows(ctx, tx, sqlResourceStats, req)
		if err != nil {
			return err
		}
		for rows.Next() {
			row := resource.ResourceStats{}
			err = rows.Scan(&row.Namespace, &row.Group, &row.Resource, &row.Count, &row.ResourceVersion)
			if err != nil {
				return err
			}
			if row.Count > int64(minCount) {
				res = append(res, row)
			} else {
				b.log.Debug("skipping stats for resource with count less than min count", "namespace", row.Namespace, "group", row.Group, "resource", row.Resource, "count", row.Count, "minCount", minCount)
			}
		}
		return err
	})

	return res, err
}

func (b *backend) WriteEvent(ctx context.Context, event resource.WriteEvent) (int64, error) {
	_, span := b.tracer.Start(ctx, tracePrefix+"WriteEvent")
	defer span.End()
	// TODO: validate key ?
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

func (b *backend) create(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"Create")
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

func (b *backend) update(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"Update")
	defer span.End()

	folder := ""
	if event.Object != nil {
		folder = event.Object.GetFolder()
	}

	// Use rvManager.ExecWithRV instead of direct transaction
	rv, err := b.rvManager.ExecWithRV(ctx, event.Key, func(tx db.Tx) (string, error) {
		// 1. Update resource
		_, err := dbutil.Exec(ctx, tx, sqlResourceUpdate, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			GUID:        event.GUID,
		})
		if err != nil {
			return event.GUID, fmt.Errorf("resource update: %w", err)
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

func (b *backend) delete(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"Delete")
	defer span.End()

	folder := ""
	if event.Object != nil {
		folder = event.Object.GetFolder()
	}
	rv, err := b.rvManager.ExecWithRV(ctx, event.Key, func(tx db.Tx) (string, error) {
		// 1. delete from resource
		_, err := dbutil.Exec(ctx, tx, sqlResourceDelete, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			GUID:        event.GUID,
		})
		if err != nil {
			return event.GUID, fmt.Errorf("delete resource: %w", err)
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

func (b *backend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *resource.BackendReadResponse {
	_, span := b.tracer.Start(ctx, tracePrefix+".Read")
	defer span.End()

	// TODO: validate key ?

	if req.ResourceVersion > 0 {
		return b.readHistory(ctx, req.Key, req.ResourceVersion)
	}

	readReq := &sqlResourceReadRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Request:     req,
		Response:    NewReadResponse(),
	}
	var res *resource.BackendReadResponse
	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		var err error
		res, err = dbutil.QueryRow(ctx, tx, sqlResourceRead, readReq)
		return err
	})

	if errors.Is(err, sql.ErrNoRows) {
		return &resource.BackendReadResponse{
			Error: resource.NewNotFoundError(req.Key),
		}
	} else if err != nil {
		return &resource.BackendReadResponse{Error: resource.AsErrorResult(err)}
	}

	return res
}

func (b *backend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"List")
	defer span.End()

	if err := resource.MigrateListRequestVersionMatch(req, b.log); err != nil {
		return 0, err
	}

	if req.Options == nil || req.Options.Key.Group == "" || req.Options.Key.Resource == "" {
		return 0, fmt.Errorf("missing group or resource")
	}

	// TODO: think about how to handler VersionMatch. We should be able to use latest for the first page (only).

	// TODO: add support for RemainingItemCount

	if req.ResourceVersion > 0 || req.NextPageToken != "" {
		return b.listAtRevision(ctx, req, cb)
	}
	return b.listLatest(ctx, req, cb)
}

func (b *backend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"ListHistory")
	defer span.End()

	return b.getHistory(ctx, req, cb)
}

// listLatest fetches the resources from the resource table.
func (b *backend) listLatest(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"listLatest")
	defer span.End()

	if req.NextPageToken != "" {
		return 0, fmt.Errorf("only works for the first page")
	}
	if req.ResourceVersion > 0 {
		return 0, fmt.Errorf("only works for the 'latest' resource version")
	}

	iter := &listIter{sortAsc: false}
	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		var err error
		iter.listRV, err = b.fetchLatestRV(ctx, tx, b.dialect, req.Options.Key.Group, req.Options.Key.Resource)
		if err != nil {
			return err
		}

		listReq := sqlResourceListRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Request:     new(resourcepb.ListRequest),
		}
		listReq.Request = proto.Clone(req).(*resourcepb.ListRequest)

		rows, err := dbutil.QueryRows(ctx, tx, sqlResourceList, listReq)
		if rows != nil {
			defer func() {
				if err := rows.Close(); err != nil {
					b.log.Warn("listLatest error closing rows", "error", err)
				}
			}()
		}
		if err != nil {
			return err
		}

		iter.rows = rows
		return cb(iter)
	})
	return iter.listRV, err
}

// ListModifiedSince will return all resources that have changed since the given resource version.
// If a resource has changes, only the latest change will be returned.
func (b *backend) ListModifiedSince(ctx context.Context, key resource.NamespacedResource, sinceRv int64) (int64, iter.Seq2[*resource.ModifiedResource, error]) {
	// We don't use an explicit transaction for fetching LatestRV and subsequent fetching of resources.
	// To guarantee that we don't include events with RV > LatestRV, we include the check in SQL query.

	// Fetch latest RV.
	latestRv, err := b.fetchLatestRV(ctx, b.db, b.dialect, key.Group, key.Resource)
	if err != nil {
		return 0, func(yield func(*resource.ModifiedResource, error) bool) {
			yield(nil, err)
		}
	}

	// If latest RV is the same as request RV, there's nothing to report, and we can avoid running another query.
	if latestRv == sinceRv {
		return latestRv, func(yield func(*resource.ModifiedResource, error) bool) { /* nothing to return */ }
	}

	// since results are sorted by name ASC and rv DESC, we can get away with tracking the last seen
	lastSeen := ""

	seq := func(yield func(*resource.ModifiedResource, error) bool) {
		query := sqlResourceListModifiedSinceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Namespace:   key.Namespace,
			Group:       key.Group,
			Resource:    key.Resource,
			SinceRv:     sinceRv,
			LatestRv:    latestRv,
		}

		rows, err := dbutil.QueryRows(ctx, b.db, sqlResourceHistoryListModifiedSince, query)
		if err != nil {
			yield(nil, err)
			return
		}
		if rows != nil {
			defer func() {
				if cerr := rows.Close(); cerr != nil {
					b.log.Warn("listSinceModified error closing rows", "error", cerr)
				}
			}()
		}

		for rows.Next() {
			mr := &resource.ModifiedResource{}
			if err := rows.Scan(&mr.Key.Namespace, &mr.Key.Group, &mr.Key.Resource, &mr.Key.Name, &mr.ResourceVersion, &mr.Action, &mr.Value); err != nil {
				if !yield(nil, err) {
					return
				}
				continue
			}

			// Deduplicate by name (namespace, group, and resource are always the same in the result set)
			if mr.Key.Name == lastSeen {
				continue
			}

			lastSeen = mr.Key.Name

			if !yield(mr, nil) {
				return
			}
		}
	}

	return latestRv, seq
}

// listAtRevision fetches the resources from the resource_history table at a specific revision.
func (b *backend) listAtRevision(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"listAtRevision")
	defer span.End()

	// Get the RV
	iter := &listIter{listRV: req.ResourceVersion, sortAsc: false}
	if req.NextPageToken != "" {
		continueToken, err := resource.GetContinueToken(req.NextPageToken)
		if err != nil {
			return 0, fmt.Errorf("get continue token (%q): %w", req.NextPageToken, err)
		}
		iter.listRV = continueToken.ResourceVersion
		iter.offset = continueToken.StartOffset

		if req.ResourceVersion != 0 && req.ResourceVersion != iter.listRV {
			return 0, apierrors.NewBadRequest("request resource version does not math token")
		}
	}
	if iter.listRV < 1 {
		return 0, apierrors.NewBadRequest("expecting an explicit resource version query")
	}

	// The query below has the potential to be EXTREMELY slow if the resource_history table is big. May be helpful to know
	// which stack is calling this.
	b.log.Debug("listAtRevision", "ns", req.Options.Key.Namespace, "group", req.Options.Key.Group, "resource", req.Options.Key.Resource, "rv", iter.listRV)

	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		limit := int64(0) // ignore limit
		if iter.offset > 0 {
			limit = math.MaxInt64 // a limit is required for offset
		}
		listReq := sqlResourceHistoryListRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Request: &historyListRequest{
				ResourceVersion: iter.listRV,
				Limit:           limit,
				Offset:          iter.offset,
				Options:         req.Options,
			},
		}

		rows, err := dbutil.QueryRows(ctx, tx, sqlResourceHistoryList, listReq)
		if rows != nil {
			defer func() {
				if err := rows.Close(); err != nil {
					b.log.Warn("listAtRevision error closing rows", "error", err)
				}
			}()
		}
		if err != nil {
			return err
		}

		iter.rows = rows
		return cb(iter)
	})
	return iter.listRV, err
}

// readHistory fetches the resource history from the resource_history table.
func (b *backend) readHistory(ctx context.Context, key *resourcepb.ResourceKey, rv int64) *resource.BackendReadResponse {
	_, span := b.tracer.Start(ctx, tracePrefix+".ReadHistory")
	defer span.End()

	readReq := &sqlResourceHistoryReadRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Request: &historyReadRequest{
			Key:             key,
			ResourceVersion: rv,
		},
		Response: NewReadResponse(),
	}

	var res *resource.BackendReadResponse
	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		var err error
		res, err = dbutil.QueryRow(ctx, tx, sqlResourceHistoryRead, readReq)
		return err
	})

	if errors.Is(err, sql.ErrNoRows) {
		return &resource.BackendReadResponse{Error: resource.NewNotFoundError(key)}
	}
	if err != nil {
		return &resource.BackendReadResponse{Error: resource.AsErrorResult(err)}
	}

	return res
}

// getHistory fetches the resource history from the resource_history table.
func (b *backend) getHistory(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"getHistory")
	defer span.End()
	listReq := sqlGetHistoryRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Key:         req.Options.Key,
		Trash:       req.Source == resourcepb.ListRequest_TRASH,
	}

	// We are assuming that users want history in ascending order
	// when they are using NotOlderThan matching, and descending order
	// for Unset (default) and Exact matching.
	listReq.SortAscending = req.GetVersionMatchV2() == resourcepb.ResourceVersionMatchV2_NotOlderThan

	iter := &listIter{
		useCurrentRV: true, // use the current RV for the continue token instead of the listRV
	}
	if req.NextPageToken != "" {
		continueToken, err := resource.GetContinueToken(req.NextPageToken)
		if err != nil {
			return 0, fmt.Errorf("get continue token (%q): %w", req.NextPageToken, err)
		}
		listReq.StartRV = continueToken.ResourceVersion
		listReq.SortAscending = continueToken.SortAscending
	}
	iter.sortAsc = listReq.SortAscending

	// Set ExactRV when using Exact matching
	if req.VersionMatchV2 == resourcepb.ResourceVersionMatchV2_Exact {
		if req.ResourceVersion <= 0 {
			return 0, fmt.Errorf("expecting an explicit resource version query when using Exact matching")
		}
		listReq.ExactRV = req.ResourceVersion
	}

	// Set MinRV when using NotOlderThan matching to filter at the database level
	if req.ResourceVersion > 0 && req.VersionMatchV2 == resourcepb.ResourceVersionMatchV2_NotOlderThan {
		listReq.MinRV = req.ResourceVersion
	}

	// Ignore last deleted history record when listing the trash, using exact matching or not older than matching with a specific RV
	useLatestDeletionAsMinRV := listReq.MinRV == 0 && !listReq.Trash && req.VersionMatchV2 != resourcepb.ResourceVersionMatchV2_Exact

	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		var err error
		iter.listRV, err = b.fetchLatestRV(ctx, tx, b.dialect, req.Options.Key.Group, req.Options.Key.Resource)
		if err != nil {
			return err
		}

		if useLatestDeletionAsMinRV {
			latestDeletedRV, err := b.fetchLatestHistoryRV(ctx, tx, b.dialect, req.Options.Key, resourcepb.WatchEvent_DELETED)
			if err != nil {
				return err
			}
			listReq.MinRV = latestDeletedRV + 1
		}

		var rows db.Rows
		if listReq.Trash {
			// unlike history, trash will not return an object if an object of the same name is live
			// (i.e. in the resource table)
			rows, err = dbutil.QueryRows(ctx, tx, sqlResourceTrash, listReq)
		} else {
			rows, err = dbutil.QueryRows(ctx, tx, sqlResourceHistoryGet, listReq)
		}
		if rows != nil {
			defer func() {
				if err := rows.Close(); err != nil {
					b.log.Warn("listLatest error closing rows", "error", err)
				}
			}()
		}
		if err != nil {
			return err
		}

		iter.rows = rows
		return cb(iter)
	})
	return iter.listRV, err
}

func (b *backend) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	return b.notifier.notify(ctx)
}

// listLatestRVs returns the latest resource version for each (Group, Resource) pair.
func (b *backend) listLatestRVs(ctx context.Context) (groupResourceRV, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"listLatestRVs")
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

// fetchLatestRV returns the current maximum RV in the resource table
func (b *backend) fetchLatestRV(ctx context.Context, x db.ContextExecer, d sqltemplate.Dialect, group, resource string) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"fetchLatestRV")
	defer span.End()
	res, err := dbutil.QueryRow(ctx, x, sqlResourceVersionGet, sqlResourceVersionGetRequest{
		SQLTemplate: sqltemplate.New(d),
		Group:       group,
		Resource:    resource,
		ReadOnly:    true,
		Response:    new(resourceVersionResponse),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return 1, nil
	} else if err != nil {
		return 0, fmt.Errorf("get resource version: %w", err)
	}
	return res.ResourceVersion, nil
}

// fetchLatestHistoryRV returns the current maximum RV in the resource_history table
func (b *backend) fetchLatestHistoryRV(ctx context.Context, x db.ContextExecer, d sqltemplate.Dialect, key *resourcepb.ResourceKey, eventType resourcepb.WatchEvent_Type) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"fetchLatestHistoryRV")
	defer span.End()
	res, err := dbutil.QueryRow(ctx, x, sqlResourceHistoryReadLatestRV, sqlResourceHistoryReadLatestRVRequest{
		SQLTemplate: sqltemplate.New(d),
		Request: &historyReadLatestRVRequest{
			Key:       key,
			EventType: eventType,
		},
		Response: new(resourceHistoryReadLatestRVResponse),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	} else if err != nil {
		return 0, fmt.Errorf("get resource version: %w", err)
	}
	return res.ResourceVersion, nil
}
