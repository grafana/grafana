package sql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

const trace_prefix = "sql.resource."

type Backend interface {
	resource.StorageBackend
	resource.DiagnosticsServer
	resource.LifecycleHooks
}

type BackendOptions struct {
	DBProvider db.DBProvider
	Tracer     trace.Tracer
}

func NewBackend(opts BackendOptions) (Backend, error) {
	if opts.DBProvider == nil {
		return nil, errors.New("no db provider")
	}
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("sql-backend")
	}
	ctx, cancel := context.WithCancel(context.Background())

	return &backend{
		done:       ctx.Done(),
		cancel:     cancel,
		log:        log.New("sql-resource-server"),
		tracer:     opts.Tracer,
		dbProvider: opts.DBProvider,
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

func (b *backend) Read(ctx context.Context, req *resource.ReadRequest) (*resource.ReadResponse, error) {
	_, span := b.tracer.Start(ctx, trace_prefix+".Read")
	defer span.End()

	// TODO: validate key ?

	readReq := sqlResourceReadRequest{
		SQLTemplate:  sqltemplate.New(b.dialect),
		Request:      req,
		readResponse: new(readResponse),
	}

	sr := sqlResourceRead
	if req.ResourceVersion > 0 {
		// read a specific version
		sr = sqlResourceHistoryRead
	}

	res, err := dbutil.QueryRow(ctx, b.db, sr, readReq)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, resource.ErrNotFound
	} else if err != nil {
		return nil, fmt.Errorf("get resource version: %w", err)
	}

	return &res.ReadResponse, nil
}

func (b *backend) PrepareList(ctx context.Context, req *resource.ListRequest) (*resource.ListResponse, error) {
	_, span := b.tracer.Start(ctx, trace_prefix+"List")
	defer span.End()

	if req.Options == nil || req.Options.Key.Group == "" || req.Options.Key.Resource == "" {
		return nil, fmt.Errorf("missing group or resource")
	}

	// TODO: think about how to handler VersionMatch. We should be able to use latest for the first page (only).

	// TODO: add support for RemainingItemCount

	if req.ResourceVersion > 0 || req.NextPageToken != "" {
		return b.listAtRevision(ctx, req)
	}
	return b.listLatest(ctx, req)
}

// listLatest fetches the resources from the resource table.
func (b *backend) listLatest(ctx context.Context, req *resource.ListRequest) (*resource.ListResponse, error) {
	out := &resource.ListResponse{
		ResourceVersion: 0,
	}

	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		var err error

		out.ResourceVersion, err = fetchLatestRV(ctx, tx, b.dialect, req.Options.Key.Group, req.Options.Key.Resource)
		if err != nil {
			return err
		}

		listReq := sqlResourceListRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Request:     new(resource.ListRequest),
			Response:    new(resource.ResourceWrapper),
		}
		listReq.Request = proto.Clone(req).(*resource.ListRequest)
		if req.Limit > 0 {
			listReq.Request.Limit++ // fetch one extra row for Limit
		}

		items, err := dbutil.Query(ctx, tx, sqlResourceList, listReq)
		if err != nil {
			return fmt.Errorf("list latest resources: %w", err)
		}

		if 0 < req.Limit && int(req.Limit) < len(items) {
			// remove the additional item we added synthetically above
			clear(items[req.Limit:])
			items = items[:req.Limit]

			out.NextPageToken = ContinueToken{
				ResourceVersion: out.ResourceVersion,
				StartOffset:     req.Limit,
			}.String()
		}
		out.Items = items

		return nil
	})

	return out, err
}

// listAtRevision fetches the resources from the resource_history table at a specific revision.
func (b *backend) listAtRevision(ctx context.Context, req *resource.ListRequest) (*resource.ListResponse, error) {
	// Get the RV
	rv := req.ResourceVersion
	offset := int64(0)
	if req.NextPageToken != "" {
		continueToken, err := GetContinueToken(req.NextPageToken)
		if err != nil {
			return nil, fmt.Errorf("get continue token: %w", err)
		}
		rv = continueToken.ResourceVersion
		offset = continueToken.StartOffset
	}

	out := &resource.ListResponse{
		ResourceVersion: rv,
	}

	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		listReq := sqlResourceHistoryListRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Request: &historyListRequest{
				ResourceVersion: rv,
				Limit:           req.Limit,
				Offset:          offset,
				Options:         req.Options,
			},
			Response: new(resource.ResourceWrapper),
		}
		if listReq.Request.Limit > 0 {
			listReq.Request.Limit++ // fetch one extra row for Limit
		}

		items, err := dbutil.Query(ctx, tx, sqlResourceHistoryList, listReq)
		if err != nil {
			return fmt.Errorf("list resources at revision: %w", err)
		}

		if 0 < req.Limit && int(req.Limit) < len(items) {
			// remove the additional item we added synthetically above
			clear(items[req.Limit:])
			items = items[:req.Limit]

			out.NextPageToken = ContinueToken{
				ResourceVersion: out.ResourceVersion,
				StartOffset:     req.Limit + offset,
			}.String()
		}
		out.Items = items

		return nil
	})

	return out, err
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
	interval := 100 * time.Millisecond // TODO make this configurable
	t := time.NewTicker(interval)
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
				t.Reset(interval)
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
						t.Reset(interval)
						continue
					}
					since[group][resource] = next
				}
			}

			t.Reset(interval)
		}
	}
}

// listLatestRVs returns the latest resource version for each (Group, Resource) pair.
func (b *backend) listLatestRVs(ctx context.Context) (groupResourceRV, error) {
	since := groupResourceRV{}
	reqRVs := sqlResourceVersionListRequest{
		SQLTemplate:          sqltemplate.New(b.dialect),
		groupResourceVersion: new(groupResourceVersion),
	}
	query, err := sqltemplate.Execute(sqlResourceVersionList, reqRVs)
	if err != nil {
		return nil, fmt.Errorf("execute SQL template to get the latest resource version: %w", err)
	}
	rows, err := b.db.QueryContext(ctx, query, reqRVs.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("fetching recent resource versions: %w", err)
	}
	defer func() { _ = rows.Close() }()

	for rows.Next() {
		if err := rows.Scan(reqRVs.GetScanDest()...); err != nil {
			return nil, err
		}
		if _, ok := since[reqRVs.Group]; !ok {
			since[reqRVs.Group] = map[string]int64{}
		}
		if _, ok := since[reqRVs.Group][reqRVs.Resource]; !ok {
			since[reqRVs.Group] = map[string]int64{}
		}
		since[reqRVs.Group][reqRVs.Resource] = reqRVs.ResourceVersion
	}
	return since, nil
}

// fetchLatestRV returns the current maximum RV in the resource table
func fetchLatestRV(ctx context.Context, x db.ContextExecer, d sqltemplate.Dialect, group, resource string) (int64, error) {
	res, err := dbutil.QueryRow(ctx, x, sqlResourceVersionGet, sqlResourceVersionRequest{
		SQLTemplate:     sqltemplate.New(d),
		Group:           group,
		Resource:        resource,
		resourceVersion: new(resourceVersion),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return 0, fmt.Errorf("now row for the provided resource version")
	} else if err != nil {
		return 0, fmt.Errorf("get resource version: %w", err)
	}
	return res.ResourceVersion, nil
}

func (b *backend) poll(ctx context.Context, grp string, res string, since int64, stream chan<- *resource.WrittenEvent) (int64, error) {
	ctx, span := b.tracer.Start(ctx, trace_prefix+"poll")
	defer span.End()

	pollReq := sqlResourceHistoryPollRequest{
		SQLTemplate:          sqltemplate.New(b.dialect),
		Resource:             res,
		Group:                grp,
		SinceResourceVersion: since,
		Response:             &historyPollResponse{},
	}
	query, err := sqltemplate.Execute(sqlResourceHistoryPoll, pollReq)
	if err != nil {
		return since, fmt.Errorf("execute SQL template to poll for resource history: %w", err)
	}
	rows, err := b.db.QueryContext(ctx, query, pollReq.GetArgs()...)
	if err != nil {
		return since, fmt.Errorf("poll for resource history: %w", err)
	}

	defer func() { _ = rows.Close() }()
	nextRV := since
	for rows.Next() {
		// check if the context is done
		if ctx.Err() != nil {
			return nextRV, ctx.Err()
		}
		if err := rows.Scan(pollReq.GetScanDest()...); err != nil {
			return nextRV, fmt.Errorf("scan row polling for resource history: %w", err)
		}
		resp := pollReq.Response
		if resp.Key.Group == "" || resp.Key.Resource == "" || resp.Key.Name == "" {
			return nextRV, fmt.Errorf("missing key in response")
		}
		nextRV = resp.ResourceVersion
		stream <- &resource.WrittenEvent{
			WriteEvent: resource.WriteEvent{
				Value: resp.Value,
				Key: &resource.ResourceKey{
					Namespace: resp.Key.Namespace,
					Group:     resp.Key.Group,
					Resource:  resp.Key.Resource,
					Name:      resp.Key.Name,
				},
				Type: resource.WatchEvent_Type(resp.Action),
			},
			ResourceVersion: resp.ResourceVersion,
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
	// TODO: refactor this code to run in a multi-statement transaction in order to minimise the number of roundtrips.
	// 1 Lock the row for update
	rv, err := dbutil.QueryRow(ctx, x, sqlResourceVersionGet, sqlResourceVersionRequest{
		SQLTemplate:     sqltemplate.New(d),
		Group:           key.Group,
		Resource:        key.Resource,
		resourceVersion: new(resourceVersion),
	})

	if errors.Is(err, sql.ErrNoRows) {
		// if there wasn't a row associated with the given resource, we create one with
		// version 1
		if _, err = dbutil.Exec(ctx, x, sqlResourceVersionInsert, sqlResourceVersionRequest{
			SQLTemplate: sqltemplate.New(d),
			Group:       key.Group,
			Resource:    key.Resource,
		}); err != nil {
			return 0, fmt.Errorf("insert into resource_version: %w", err)
		}
		return 1, nil
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

	// 3. Retun the incremended value
	return nextRV, nil
}
