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
	"go.opentelemetry.io/otel/attribute"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/protobuf/proto"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
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
	PollingInterval time.Duration
	WatchBufferSize int
	IsHA            bool
	storageMetrics  *resource.StorageMetrics

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
		dbProvider:              opts.DBProvider,
		pollingInterval:         opts.PollingInterval,
		watchBufferSize:         opts.WatchBufferSize,
		storageMetrics:          opts.storageMetrics,
		bulkLock:                &bulkLock{running: make(map[string]bool)},
		simulatedNetworkLatency: opts.SimulatedNetworkLatency,
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
	log            log.Logger
	tracer         trace.Tracer
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

	// testing
	simulatedNetworkLatency time.Duration
}

func (b *backend) Init(ctx context.Context) error {
	b.initOnce.Do(func() {
		b.initErr = b.initLocked(ctx)
	})
	return b.initErr
}

func (b *backend) initLocked(ctx context.Context) error {
	db, err := b.dbProvider.Init(ctx)
	if err != nil {
		return fmt.Errorf("initialize resource DB: %w", err)
	}
	b.db = db

	driverName := db.DriverName()
	b.dialect = sqltemplate.DialectForDriver(driverName)
	if b.dialect == nil {
		return fmt.Errorf("no dialect for driver %q", driverName)
	}

	// Initialize notifier after dialect is set up
	notifier, err := newNotifier(b)
	if err != nil {
		return fmt.Errorf("failed to create notifier: %w", err)
	}
	b.notifier = notifier

	return b.db.PingContext(ctx)
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
		if event.ObjectOld != nil {
			return b.restore(ctx, event)
		}
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
	var newVersion int64
	guid := uuid.New().String()
	folder := ""
	if event.Object != nil {
		folder = event.Object.GetFolder()
	}
	err := b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		// 1. Insert into resource
		if _, err := dbutil.Exec(ctx, tx, sqlResourceInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			GUID:        guid,
		}); err != nil {
			return fmt.Errorf("insert into resource: %w", err)
		}

		// 2. Insert into resource history
		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			GUID:        guid,
		}); err != nil {
			return fmt.Errorf("insert into resource history: %w", err)
		}

		// 3. TODO: Rebuild the whole folder tree structure if we're creating a folder

		// 4. Atomically increment resource version for this kind
		rv, err := b.resourceVersionAtomicInc(ctx, tx, event.Key)
		if err != nil {
			return fmt.Errorf("increment resource version: %w", err)
		}

		// 5. Update the RV in both resource and resource_history
		if _, err = dbutil.Exec(ctx, tx, sqlResourceHistoryUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate:     sqltemplate.New(b.dialect),
			GUID:            guid,
			ResourceVersion: rv,
		}); err != nil {
			return fmt.Errorf("update resource_history rv: %w", err)
		}

		if _, err = dbutil.Exec(ctx, tx, sqlResourceUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate:     sqltemplate.New(b.dialect),
			GUID:            guid,
			ResourceVersion: rv,
		}); err != nil {
			return fmt.Errorf("update resource rv: %w", err)
		}
		newVersion = rv
		if b.simulatedNetworkLatency > 0 {
			time.Sleep(b.simulatedNetworkLatency)
		}
		return nil
	})

	if err != nil {
		return 0, err
	}

	b.notifier.send(ctx, &resource.WrittenEvent{
		Type:            event.Type,
		Key:             event.Key,
		PreviousRV:      event.PreviousRV,
		Value:           event.Value,
		ResourceVersion: newVersion,
		Folder:          folder,
	})

	return newVersion, nil
}

func (b *backend) update(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"Update")
	defer span.End()
	var newVersion int64
	guid := uuid.New().String()
	folder := ""
	if event.Object != nil {
		folder = event.Object.GetFolder()
	}
	err := b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		// 1. Update resource
		_, err := dbutil.Exec(ctx, tx, sqlResourceUpdate, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			GUID:        guid,
		})
		if err != nil {
			return fmt.Errorf("initial resource update: %w", err)
		}

		// 2. Insert into resource history
		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			GUID:        guid,
		}); err != nil {
			return fmt.Errorf("insert into resource history: %w", err)
		}

		// 3. TODO: Rebuild the whole folder tree structure if we're creating a folder

		// 4. Atomically increment resource version for this kind
		rv, err := b.resourceVersionAtomicInc(ctx, tx, event.Key)
		if err != nil {
			return fmt.Errorf("increment resource version: %w", err)
		}

		// 5. Update the RV in both resource and resource_history
		if _, err = dbutil.Exec(ctx, tx, sqlResourceHistoryUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate:     sqltemplate.New(b.dialect),
			GUID:            guid,
			ResourceVersion: rv,
		}); err != nil {
			return fmt.Errorf("update history rv: %w", err)
		}

		if _, err = dbutil.Exec(ctx, tx, sqlResourceUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate:     sqltemplate.New(b.dialect),
			GUID:            guid,
			ResourceVersion: rv,
		}); err != nil {
			return fmt.Errorf("update resource rv: %w", err)
		}
		newVersion = rv

		return nil
	})

	if err != nil {
		return 0, err
	}

	b.notifier.send(ctx, &resource.WrittenEvent{
		Type:            event.Type,
		Key:             event.Key,
		PreviousRV:      event.PreviousRV,
		Value:           event.Value,
		ResourceVersion: newVersion,
		Folder:          folder,
	})

	return newVersion, nil
}

func (b *backend) delete(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"Delete")
	defer span.End()
	var newVersion int64
	guid := uuid.New().String()
	folder := ""
	if event.Object != nil {
		folder = event.Object.GetFolder()
	}
	err := b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		// 1. delete from resource
		_, err := dbutil.Exec(ctx, tx, sqlResourceDelete, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			GUID:        guid,
		})
		if err != nil {
			return fmt.Errorf("delete resource: %w", err)
		}

		// 2. Add event to resource history
		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			GUID:        guid,
		}); err != nil {
			return fmt.Errorf("insert into resource history: %w", err)
		}

		// 3. TODO: Rebuild the whole folder tree structure if we're creating a folder

		// 4. Atomically increment resource version for this kind
		rv, err := b.resourceVersionAtomicInc(ctx, tx, event.Key)
		if err != nil {
			return fmt.Errorf("increment resource version: %w", err)
		}

		// 5. Update the RV in resource_history
		if _, err = dbutil.Exec(ctx, tx, sqlResourceHistoryUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate:     sqltemplate.New(b.dialect),
			GUID:            guid,
			ResourceVersion: rv,
		}); err != nil {
			return fmt.Errorf("update history rv: %w", err)
		}
		newVersion = rv

		return nil
	})

	if err != nil {
		return 0, err
	}

	b.notifier.send(ctx, &resource.WrittenEvent{
		Type:            event.Type,
		Key:             event.Key,
		PreviousRV:      event.PreviousRV,
		Value:           event.Value,
		ResourceVersion: newVersion,
		Folder:          folder,
	})

	return newVersion, nil
}

func (b *backend) restore(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"Restore")
	defer span.End()
	var newVersion int64
	guid := uuid.New().String()
	folder := ""
	if event.Object != nil {
		folder = event.Object.GetFolder()
	}
	err := b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		// 1. Re-create resource
		// Note: we may want to replace the write event with a create event, tbd.
		if _, err := dbutil.Exec(ctx, tx, sqlResourceInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			GUID:        guid,
		}); err != nil {
			return fmt.Errorf("insert into resource: %w", err)
		}

		// 2. Insert into resource history
		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			Folder:      folder,
			GUID:        guid,
		}); err != nil {
			return fmt.Errorf("insert into resource history: %w", err)
		}

		// 3. TODO: Rebuild the whole folder tree structure if we're creating a folder

		// 4. Atomically increment resource version for this kind
		rv, err := b.resourceVersionAtomicInc(ctx, tx, event.Key)
		if err != nil {
			return fmt.Errorf("increment resource version: %w", err)
		}

		// 5. Update the RV in both resource and resource_history
		if _, err = dbutil.Exec(ctx, tx, sqlResourceHistoryUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate:     sqltemplate.New(b.dialect),
			GUID:            guid,
			ResourceVersion: rv,
		}); err != nil {
			return fmt.Errorf("update history rv: %w", err)
		}

		if _, err = dbutil.Exec(ctx, tx, sqlResourceUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate:     sqltemplate.New(b.dialect),
			GUID:            guid,
			ResourceVersion: rv,
		}); err != nil {
			return fmt.Errorf("update resource rv: %w", err)
		}

		// 6. Update all resource history entries with the new UID
		// Note: we do not update any history entries that have a deletion timestamp included. This will become
		// important once we start using finalizers, as the initial delete will show up as an update with a deletion timestamp included.
		if _, err = dbutil.Exec(ctx, tx, sqlResoureceHistoryUpdateUid, sqlResourceHistoryUpdateRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			OldUID:      string(event.ObjectOld.GetUID()),
			NewUID:      string(event.Object.GetUID()),
		}); err != nil {
			return fmt.Errorf("update history uid: %w", err)
		}

		newVersion = rv

		return nil
	})

	if err != nil {
		return 0, err
	}

	b.notifier.send(ctx, &resource.WrittenEvent{
		Type:            event.Type,
		Key:             event.Key,
		PreviousRV:      event.PreviousRV,
		Value:           event.Value,
		ResourceVersion: newVersion,
		Folder:          folder,
	})

	return newVersion, nil
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
		// if not found, look for latest deleted version (if requested)
		if errors.Is(err, sql.ErrNoRows) && req.IncludeDeleted {
			sr = sqlResourceHistoryRead
			readReq2 := &sqlResourceReadRequest{
				SQLTemplate: sqltemplate.New(b.dialect),
				Request:     req,
				Response:    NewReadResponse(),
			}
			res, err = dbutil.QueryRow(ctx, tx, sr, readReq2)
			return err
		}
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

// resourceVersionAtomicInc atomically increases the version of a kind within a transaction.
// TODO: Ideally we should attempt to update the RV in the resource and resource_history tables
// in a single roundtrip. This would reduce the latency of the operation, and also increase the
// throughput of the system. This is a good candidate for a future optimization.
func (b *backend) resourceVersionAtomicInc(ctx context.Context, x db.ContextExecer, key *resource.ResourceKey) (newVersion int64, err error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"version_atomic_inc", trace.WithAttributes(
		semconv.K8SNamespaceName(key.Namespace),
		// TODO: the following attributes could use some standardization.
		attribute.String("k8s.resource.group", key.Group),
		attribute.String("k8s.resource.type", key.Resource),
	))
	defer span.End()

	// 1. Lock to row and prevent concurrent updates until the transaction is committed.
	res, err := dbutil.QueryRow(ctx, x, sqlResourceVersionGet, sqlResourceVersionGetRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Group:       key.Group,
		Resource:    key.Resource,

		Response: new(resourceVersionResponse), ReadOnly: false, // This locks the row for update
	})

	if errors.Is(err, sql.ErrNoRows) {
		// if there wasn't a row associated with the given resource, then we create it.
		if _, err = dbutil.Exec(ctx, x, sqlResourceVersionInsert, sqlResourceVersionUpsertRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Group:       key.Group,
			Resource:    key.Resource,
		}); err != nil {
			return 0, fmt.Errorf("insert into resource_version: %w", err)
		}
		res, err = dbutil.QueryRow(ctx, x, sqlResourceVersionGet, sqlResourceVersionGetRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Group:       key.Group,
			Resource:    key.Resource,
			Response:    new(resourceVersionResponse),
			ReadOnly:    true, // This locks the row for update
		})
		if err != nil {
			return 0, fmt.Errorf("fetching RV after read")
		}
		return res.ResourceVersion, nil
	} else if err != nil {
		return 0, fmt.Errorf("lock the resource version: %w", err)
	}

	// 2. Update the RV
	// Most times, the RV is the current microsecond timestamp generated on the sql server (to avoid clock skew).
	// In rare occasion, the server clock might go back in time. In those cases, we simply increment the
	// previous RV until the clock catches up.
	nextRV := max(res.CurrentEpoch, res.ResourceVersion+1)

	_, err = dbutil.Exec(ctx, x, sqlResourceVersionUpdate, sqlResourceVersionUpsertRequest{
		SQLTemplate:     sqltemplate.New(b.dialect),
		Group:           key.Group,
		Resource:        key.Resource,
		ResourceVersion: nextRV,
	})
	if err != nil {
		return 0, fmt.Errorf("increase resource version: %w", err)
	}
	return nextRV, nil
}
