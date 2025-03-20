package sql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/protobuf/proto"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/util/debouncer"
)

const tracePrefix = "sql.resource."
const defaultPollingInterval = 100 * time.Millisecond
const defaultWatchBufferSize = 100 // number of events to buffer in the watch stream

type Backend interface {
	resource.StorageBackend
	resource.DiagnosticsServer
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
		log:                     log.New("sql-resource-server"),
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

// pruningKey is a comparable key for pruning history.
type pruningKey struct {
	namespace string
	group     string
	resource  string
	name      string
}

// Small abstraction to allow for different pruner implementations.
// This can be removed once the debouncer is deployed.
type pruner interface {
	Add(key pruningKey) error
	Start(ctx context.Context)
}

type noopPruner struct{}

func (p *noopPruner) Add(key pruningKey) error {
	return nil
}

func (p *noopPruner) Start(ctx context.Context) {}

type backend struct {
	//general
	isHA bool

	// server lifecycle
	done     <-chan struct{}
	cancel   context.CancelFunc
	initOnce sync.Once
	initErr  error

	// o11y
	log            log.Logger
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

	historyPruner pruner
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
	pruner, err := debouncer.NewGroup(debouncer.DebouncerOpts[pruningKey]{
		Name:       "history_pruner",
		BufferSize: 1000,
		MinWait:    time.Second * 30,
		MaxWait:    time.Minute * 5,
		ProcessHandler: func(ctx context.Context, key pruningKey) error {
			return b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
				res, err := dbutil.Exec(ctx, tx, sqlResourceHistoryPrune, &sqlPruneHistoryRequest{
					SQLTemplate:  sqltemplate.New(b.dialect),
					HistoryLimit: 100,
					Key: &resource.ResourceKey{
						Namespace: key.namespace,
						Group:     key.group,
						Resource:  key.resource,
						Name:      key.name,
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
					"namespace", key.namespace,
					"group", key.group,
					"resource", key.resource,
					"name", key.name,
					"rows", rows)
				return nil
			})
		},
		ErrorHandler: func(key pruningKey, err error) {
			b.log.Error("failed to prune history",
				"namespace", key.namespace,
				"group", key.group,
				"resource", key.resource,
				"name", key.name,
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

func (b *backend) IsHealthy(ctx context.Context, r *resource.HealthCheckRequest) (*resource.HealthCheckResponse, error) {
	// ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "isHealthy"}))

	if err := b.db.PingContext(ctx); err != nil {
		return nil, err
	}

	return &resource.HealthCheckResponse{Status: resource.HealthCheckResponse_SERVING}, nil
}

func (b *backend) Stop(_ context.Context) error {
	b.cancel()
	return nil
}

// GetResourceStats implements Backend.
func (b *backend) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]resource.ResourceStats, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+".GetResourceStats")
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
	case resource.WatchEvent_ADDED:
		return b.create(ctx, event)
	case resource.WatchEvent_MODIFIED:
		return b.update(ctx, event)
	case resource.WatchEvent_DELETED:
		return b.delete(ctx, event)
	default:
		return 0, fmt.Errorf("unsupported event type")
	}
}

func (b *backend) create(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"Create")
	defer span.End()

	guid := uuid.New().String()
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
			GUID:        guid,
		}); err != nil {
			return guid, fmt.Errorf("insert into resource: %w", err)
		}

		// 2. Insert into resource history
		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			GUID:        guid,
		}); err != nil {
			return guid, fmt.Errorf("insert into resource history: %w", err)
		}
		_ = b.historyPruner.Add(pruningKey{
			namespace: event.Key.Namespace,
			group:     event.Key.Group,
			resource:  event.Key.Resource,
			name:      event.Key.Name,
		})
		if b.simulatedNetworkLatency > 0 {
			time.Sleep(b.simulatedNetworkLatency)
		}
		return guid, nil
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

func (b *backend) update(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"Update")
	defer span.End()
	guid := uuid.New().String()
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
			GUID:        guid,
		})
		if err != nil {
			return guid, fmt.Errorf("resource update: %w", err)
		}

		// 2. Insert into resource history
		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			GUID:        guid,
		}); err != nil {
			return guid, fmt.Errorf("insert into resource history: %w", err)
		}
		_ = b.historyPruner.Add(pruningKey{
			namespace: event.Key.Namespace,
			group:     event.Key.Group,
			resource:  event.Key.Resource,
			name:      event.Key.Name,
		})
		return guid, nil
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
	guid := uuid.New().String()
	folder := ""
	if event.Object != nil {
		folder = event.Object.GetFolder()
	}
	rv, err := b.rvManager.ExecWithRV(ctx, event.Key, func(tx db.Tx) (string, error) {
		// 1. delete from resource
		_, err := dbutil.Exec(ctx, tx, sqlResourceDelete, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			GUID:        guid,
		})
		if err != nil {
			return guid, fmt.Errorf("delete resource: %w", err)
		}

		// 2. Add event to resource history
		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			GUID:        guid,
		}); err != nil {
			return guid, fmt.Errorf("insert into resource history: %w", err)
		}
		_ = b.historyPruner.Add(pruningKey{
			namespace: event.Key.Namespace,
			group:     event.Key.Group,
			resource:  event.Key.Resource,
			name:      event.Key.Name,
		})
		return guid, nil
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

func (b *backend) ReadResource(ctx context.Context, req *resource.ReadRequest) *resource.BackendReadResponse {
	_, span := b.tracer.Start(ctx, tracePrefix+".Read")
	defer span.End()

	// TODO: validate key ?

	readReq := &sqlResourceReadRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Request:     req,
		Response:    NewReadResponse(),
	}

	sr := sqlResourceRead
	if req.ResourceVersion > 0 {
		// read a specific version
		sr = sqlResourceHistoryRead
	}

	var res *resource.BackendReadResponse
	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		var err error
		res, err = dbutil.QueryRow(ctx, tx, sr, readReq)
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

func (b *backend) ListIterator(ctx context.Context, req *resource.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"List")
	defer span.End()

	if req.Options == nil || req.Options.Key.Group == "" || req.Options.Key.Resource == "" {
		return 0, fmt.Errorf("missing group or resource")
	}

	if req.Source != resource.ListRequest_STORE {
		return b.getHistory(ctx, req, cb)
	}

	// TODO: think about how to handler VersionMatch. We should be able to use latest for the first page (only).

	// TODO: add support for RemainingItemCount

	if req.ResourceVersion > 0 || req.NextPageToken != "" {
		return b.listAtRevision(ctx, req, cb)
	}
	return b.listLatest(ctx, req, cb)
}

type listIter struct {
	rows   db.Rows
	offset int64
	listRV int64

	// any error
	err error

	// The row
	rv        int64
	value     []byte
	namespace string
	name      string
	folder    string
}

// ContinueToken implements resource.ListIterator.
func (l *listIter) ContinueToken() string {
	return resource.ContinueToken{ResourceVersion: l.listRV, StartOffset: l.offset}.String()
}

func (l *listIter) ContinueTokenWithCurrentRV() string {
	return resource.ContinueToken{ResourceVersion: l.rv, StartOffset: l.offset}.String()
}

func (l *listIter) Error() error {
	return l.err
}

func (l *listIter) Name() string {
	return l.name
}

func (l *listIter) Namespace() string {
	return l.namespace
}

func (l *listIter) Folder() string {
	return l.folder
}

// ResourceVersion implements resource.ListIterator.
func (l *listIter) ResourceVersion() int64 {
	return l.rv
}

// Value implements resource.ListIterator.
func (l *listIter) Value() []byte {
	return l.value
}

// Next implements resource.ListIterator.
func (l *listIter) Next() bool {
	if l.rows.Next() {
		l.offset++
		l.err = l.rows.Scan(&l.rv, &l.namespace, &l.name, &l.folder, &l.value)
		return true
	}
	return false
}

var _ resource.ListIterator = (*listIter)(nil)

// listLatest fetches the resources from the resource table.
func (b *backend) listLatest(ctx context.Context, req *resource.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	if req.NextPageToken != "" {
		return 0, fmt.Errorf("only works for the first page")
	}
	if req.ResourceVersion > 0 {
		return 0, fmt.Errorf("only works for the 'latest' resource version")
	}

	iter := &listIter{}
	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		var err error
		iter.listRV, err = fetchLatestRV(ctx, tx, b.dialect, req.Options.Key.Group, req.Options.Key.Resource)
		if err != nil {
			return err
		}

		listReq := sqlResourceListRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Request:     new(resource.ListRequest),
		}
		listReq.Request = proto.Clone(req).(*resource.ListRequest)

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

// listAtRevision fetches the resources from the resource_history table at a specific revision.
func (b *backend) listAtRevision(ctx context.Context, req *resource.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	// Get the RV
	iter := &listIter{listRV: req.ResourceVersion}
	if req.NextPageToken != "" {
		continueToken, err := resource.GetContinueToken(req.NextPageToken)
		if err != nil {
			return 0, fmt.Errorf("get continue token: %w", err)
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

// listLatest fetches the resources from the resource table.
func (b *backend) getHistory(ctx context.Context, req *resource.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	listReq := sqlGetHistoryRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Key:         req.Options.Key,
		Trash:       req.Source == resource.ListRequest_TRASH,
	}

	iter := &listIter{}
	if req.NextPageToken != "" {
		continueToken, err := resource.GetContinueToken(req.NextPageToken)
		if err != nil {
			return 0, fmt.Errorf("get continue token: %w", err)
		}
		listReq.StartRV = continueToken.ResourceVersion
	}

	// Set ExactRV when using Exact matching
	if req.VersionMatch == resource.ResourceVersionMatch_Exact {
		if req.ResourceVersion <= 0 {
			return 0, fmt.Errorf("expecting an explicit resource version query when using Exact matching")
		}
		listReq.ExactRV = req.ResourceVersion
	}

	// Set MinRV when using NotOlderThan matching to filter at the database level
	if req.ResourceVersion > 0 && req.VersionMatch == resource.ResourceVersionMatch_NotOlderThan {
		listReq.MinRV = req.ResourceVersion
	}

	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		var err error
		iter.listRV, err = fetchLatestRV(ctx, tx, b.dialect, req.Options.Key.Group, req.Options.Key.Resource)
		if err != nil {
			return err
		}

		rows, err := dbutil.QueryRows(ctx, tx, sqlResourceHistoryGet, listReq)
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
func fetchLatestRV(ctx context.Context, x db.ContextExecer, d sqltemplate.Dialect, group, resource string) (int64, error) {
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
