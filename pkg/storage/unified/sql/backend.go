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
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/protobuf/proto"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

const trace_prefix = "sql.resource."
const defaultPollingInterval = 100 * time.Millisecond

type Backend interface {
	resource.StorageBackend
	resource.DiagnosticsServer
	resource.LifecycleHooks
}

type BackendOptions struct {
	DBProvider      db.DBProvider
	Tracer          trace.Tracer
	PollingInterval time.Duration
}

func NewBackend(opts BackendOptions) (Backend, error) {
	if opts.DBProvider == nil {
		return nil, errors.New("no db provider")
	}
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("sql-backend")
	}
	ctx, cancel := context.WithCancel(context.Background())

	pollingInterval := opts.PollingInterval
	if pollingInterval == 0 {
		pollingInterval = defaultPollingInterval
	}
	return &backend{
		done:            ctx.Done(),
		cancel:          cancel,
		log:             log.New("sql-resource-server"),
		tracer:          opts.Tracer,
		dbProvider:      opts.DBProvider,
		pollingInterval: pollingInterval,
	}, nil
}

type backend struct {
	// server lifecycle
	done     <-chan struct{}
	cancel   context.CancelFunc
	initOnce sync.Once
	initErr  error

	// o11y
	log    log.Logger
	tracer trace.Tracer

	// database
	dbProvider db.DBProvider
	db         db.DB
	dialect    sqltemplate.Dialect

	// watch streaming
	//stream chan *resource.WatchEvent
	pollingInterval time.Duration
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

func (b *backend) WriteEvent(ctx context.Context, event resource.WriteEvent) (int64, error) {
	_, span := b.tracer.Start(ctx, trace_prefix+"WriteEvent")
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
	ctx, span := b.tracer.Start(ctx, trace_prefix+"Create")
	defer span.End()
	var newVersion int64
	guid := uuid.New().String()
	err := b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		// TODO: Set the Labels

		// 1. Insert into resource
		if _, err := dbutil.Exec(ctx, tx, sqlResourceInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			GUID:        guid,
		}); err != nil {
			return fmt.Errorf("insert into resource: %w", err)
		}

		// 2. Insert into resource history
		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			GUID:        guid,
		}); err != nil {
			return fmt.Errorf("insert into resource history: %w", err)
		}

		// 3. TODO: Rebuild the whole folder tree structure if we're creating a folder

		// 4. Atomically increment resource version for this kind
		rv, err := resourceVersionAtomicInc(ctx, tx, b.dialect, event.Key)
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

		return nil
	})
	return newVersion, err
}

func (b *backend) update(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := b.tracer.Start(ctx, trace_prefix+"Update")
	defer span.End()
	var newVersion int64
	guid := uuid.New().String()
	err := b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		// TODO: Set the Labels

		// 1. Update resource
		_, err := dbutil.Exec(ctx, tx, sqlResourceUpdate, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			GUID:        guid,
		})
		if err != nil {
			return fmt.Errorf("initial resource update: %w", err)
		}

		// 2. Insert into resource history
		if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			WriteEvent:  event,
			GUID:        guid,
		}); err != nil {
			return fmt.Errorf("insert into resource history: %w", err)
		}

		// 3. TODO: Rebuild the whole folder tree structure if we're creating a folder

		// 4. Atomically increment resource version for this kind
		rv, err := resourceVersionAtomicInc(ctx, tx, b.dialect, event.Key)
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

	return newVersion, err
}

func (b *backend) delete(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := b.tracer.Start(ctx, trace_prefix+"Delete")
	defer span.End()
	var newVersion int64
	guid := uuid.New().String()

	err := b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		// TODO: Set the Labels

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
			GUID:        guid,
		}); err != nil {
			return fmt.Errorf("insert into resource history: %w", err)
		}

		// 3. TODO: Rebuild the whole folder tree structure if we're creating a folder

		// 4. Atomically increment resource version for this kind
		rv, err := resourceVersionAtomicInc(ctx, tx, b.dialect, event.Key)
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

	return newVersion, err
}

func (b *backend) ReadResource(ctx context.Context, req *resource.ReadRequest) *resource.ReadResponse {
	_, span := b.tracer.Start(ctx, trace_prefix+".Read")
	defer span.End()

	// TODO: validate key ?

	readReq := &sqlResourceReadRequest{
		SQLTemplate:  sqltemplate.New(b.dialect),
		Request:      req,
		readResponse: new(readResponse),
	}

	sr := sqlResourceRead
	if req.ResourceVersion > 0 {
		// read a specific version
		sr = sqlResourceHistoryRead
	}

	var res *readResponse
	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		var err error
		res, err = dbutil.QueryRow(ctx, tx, sr, readReq)
		return err
	})
	if errors.Is(err, sql.ErrNoRows) {
		return &resource.ReadResponse{
			Error: resource.NewNotFoundError(req.Key),
		}
	} else if err != nil {
		return &resource.ReadResponse{Error: resource.AsErrorResult(err)}
	}

	return &res.ReadResponse
}

func (b *backend) ListIterator(ctx context.Context, req *resource.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	_, span := b.tracer.Start(ctx, trace_prefix+"List")
	defer span.End()

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

type listIter struct {
	rows   *sql.Rows
	offset int64
	listRV int64

	// any error
	err error

	// The row
	rv        int64
	value     []byte
	namespace string
	name      string
}

// ContinueToken implements resource.ListIterator.
func (l *listIter) ContinueToken() string {
	return ContinueToken{ResourceVersion: l.listRV, StartOffset: l.offset}.String()
}

// Error implements resource.ListIterator.
func (l *listIter) Error() error {
	return l.err
}

// Name implements resource.ListIterator.
func (l *listIter) Name() string {
	return l.name
}

// Namespace implements resource.ListIterator.
func (l *listIter) Namespace() string {
	return l.namespace
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
		l.err = l.rows.Scan(&l.rv, &l.namespace, &l.name, &l.value)
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
		continueToken, err := GetContinueToken(req.NextPageToken)
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

func (b *backend) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	// Get the latest RV
	since, err := b.listLatestRVs(ctx)
	if err != nil {
		return nil, fmt.Errorf("get the latest resource version: %w", err)
	}
	// Start the poller
	stream := make(chan *resource.WrittenEvent)
	go b.poller(ctx, since, stream)
	return stream, nil
}

func (b *backend) poller(ctx context.Context, since groupResourceRV, stream chan<- *resource.WrittenEvent) {
	t := time.NewTicker(b.pollingInterval)
	defer close(stream)
	defer t.Stop()

	for {
		select {
		case <-b.done:
			return
		case <-t.C:
			// List the latest RVs
			grv, err := b.listLatestRVs(ctx)
			if err != nil {
				b.log.Error("get the latest resource version", "err", err)
				t.Reset(b.pollingInterval)
				continue
			}
			for group, items := range grv {
				for resource := range items {
					// If we haven't seen this resource before, we start from 0
					if _, ok := since[group]; !ok {
						since[group] = make(map[string]int64)
					}
					if _, ok := since[group][resource]; !ok {
						since[group][resource] = 0
					}

					// Poll for new events
					next, err := b.poll(ctx, group, resource, since[group][resource], stream)
					if err != nil {
						b.log.Error("polling for resource", "err", err)
						t.Reset(b.pollingInterval)
						continue
					}
					if next > since[group][resource] {
						since[group][resource] = next
					}
				}
			}

			t.Reset(b.pollingInterval)
		}
	}
}

// listLatestRVs returns the latest resource version for each (Group, Resource) pair.
func (b *backend) listLatestRVs(ctx context.Context) (groupResourceRV, error) {
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
	res, err := dbutil.QueryRow(ctx, x, sqlResourceVersionGet, sqlResourceVersionRequest{
		SQLTemplate:     sqltemplate.New(d),
		Group:           group,
		Resource:        resource,
		ReadOnly:        true,
		resourceVersion: new(resourceVersion),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return 1, nil
	} else if err != nil {
		return 0, fmt.Errorf("get resource version: %w", err)
	}
	return res.ResourceVersion, nil
}

func (b *backend) poll(ctx context.Context, grp string, res string, since int64, stream chan<- *resource.WrittenEvent) (int64, error) {
	ctx, span := b.tracer.Start(ctx, trace_prefix+"poll")
	defer span.End()

	var records []*historyPollResponse
	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		var err error
		records, err = dbutil.Query(ctx, tx, sqlResourceHistoryPoll, &sqlResourceHistoryPollRequest{
			SQLTemplate:          sqltemplate.New(b.dialect),
			Resource:             res,
			Group:                grp,
			SinceResourceVersion: since,
			Response:             &historyPollResponse{},
		})
		return err
	})
	if err != nil {
		return 0, fmt.Errorf("poll history: %w", err)
	}

	var nextRV int64
	for _, rec := range records {
		if rec.Key.Group == "" || rec.Key.Resource == "" || rec.Key.Name == "" {
			return nextRV, fmt.Errorf("missing key in response")
		}
		nextRV = rec.ResourceVersion
		stream <- &resource.WrittenEvent{
			WriteEvent: resource.WriteEvent{
				Value: rec.Value,
				Key: &resource.ResourceKey{
					Namespace: rec.Key.Namespace,
					Group:     rec.Key.Group,
					Resource:  rec.Key.Resource,
					Name:      rec.Key.Name,
				},
				Type:       resource.WatchEvent_Type(rec.Action),
				PreviousRV: rec.PreviousRV,
			},
			ResourceVersion: rec.ResourceVersion,
			// Timestamp:  , // TODO: add timestamp
		}
	}

	return nextRV, nil
}

// resourceVersionAtomicInc atomically increases the version of a kind within a
// transaction.
// TODO: Ideally we should attempt to update the RV in the resource and resource_history tables
// in a single roundtrip. This would reduce the latency of the operation, and also increase the
// throughput of the system. This is a good candidate for a future optimization.
func resourceVersionAtomicInc(ctx context.Context, x db.ContextExecer, d sqltemplate.Dialect, key *resource.ResourceKey) (newVersion int64, err error) {
	// TODO: refactor this code to run in a multi-statement transaction in order to minimize the number of round trips.
	// 1 Lock the row for update
	rv, err := dbutil.QueryRow(ctx, x, sqlResourceVersionGet, sqlResourceVersionRequest{
		SQLTemplate:     sqltemplate.New(d),
		Group:           key.Group,
		Resource:        key.Resource,
		resourceVersion: new(resourceVersion),
	})

	if errors.Is(err, sql.ErrNoRows) {
		// if there wasn't a row associated with the given resource, we create one with
		// version 2 to match the etcd behavior.
		if _, err = dbutil.Exec(ctx, x, sqlResourceVersionInsert, sqlResourceVersionRequest{
			SQLTemplate:     sqltemplate.New(d),
			Group:           key.Group,
			Resource:        key.Resource,
			resourceVersion: &resourceVersion{1},
		}); err != nil {
			return 0, fmt.Errorf("insert into resource_version: %w", err)
		}
		return 2, nil
	}

	if err != nil {
		return 0, fmt.Errorf("get current resource version: %w", err)
	}
	nextRV := rv.ResourceVersion + 1

	// 2. Increment the resource version
	_, err = dbutil.Exec(ctx, x, sqlResourceVersionInc, sqlResourceVersionRequest{
		SQLTemplate: sqltemplate.New(d),
		Group:       key.Group,
		Resource:    key.Resource,
		resourceVersion: &resourceVersion{
			ResourceVersion: nextRV,
		},
	})
	if err != nil {
		return 0, fmt.Errorf("increase resource version: %w", err)
	}

	// 3. Return the incremented value
	return nextRV, nil
}
