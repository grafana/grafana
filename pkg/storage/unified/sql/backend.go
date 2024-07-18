package sql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"text/template"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

const trace_prefix = "sql.resource."

type Backend interface {
	resource.StorageBackend
	resource.DiagnosticsServer
	resource.LifecycleHooks
}

type BackendOptions struct {
	DB     db.ResourceDBInterface
	Tracer trace.Tracer
}

func NewBackend(opts BackendOptions) (Backend, error) {
	ctx, cancel := context.WithCancel(context.Background())

	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("sql-backend")
	}

	return &backend{
		db:     opts.DB,
		log:    log.New("sql-resource-server"),
		done:   ctx.Done(),
		cancel: cancel,
		tracer: opts.Tracer,
	}, nil
}

type backend struct {
	// server lifecycle

	done   <-chan struct{}
	cancel context.CancelFunc

	// o11y

	log    log.Logger
	tracer trace.Tracer

	// database

	db         db.ResourceDBInterface // used for deferred initialization
	sqlDB      db.DB
	sqlDialect sqltemplate.Dialect

	//stream chan *resource.WatchEvent
}

func (b *backend) Init() error {
	if b.sqlDB != nil {
		return nil
	}

	if b.db == nil {
		return errors.New("missing db")
	}

	err := b.db.Init()
	if err != nil {
		return err
	}

	sqlDB, err := b.db.GetDB()
	if err != nil {
		return err
	}
	b.sqlDB = sqlDB

	driverName := sqlDB.DriverName()
	driverName = strings.TrimSuffix(driverName, "WithHooks")
	switch driverName {
	case db.DriverMySQL:
		b.sqlDialect = sqltemplate.MySQL
	case db.DriverPostgres:
		b.sqlDialect = sqltemplate.PostgreSQL
	case db.DriverSQLite, db.DriverSQLite3:
		b.sqlDialect = sqltemplate.SQLite
	default:
		return fmt.Errorf("no dialect for driver %q", driverName)
	}

	return nil
}

func (b *backend) IsHealthy(ctx context.Context, r *resource.HealthCheckRequest) (*resource.HealthCheckResponse, error) {
	// ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "isHealthy"}))

	if err := b.sqlDB.PingContext(ctx); err != nil {
		return nil, err
	}
	// TODO: check the status of the watcher implementation as well
	return &resource.HealthCheckResponse{Status: resource.HealthCheckResponse_SERVING}, nil
}

func (b *backend) Stop() {
	b.cancel()
}

func (b *backend) WriteEvent(ctx context.Context, event resource.WriteEvent) (int64, error) {
	_, span := b.tracer.Start(ctx, trace_prefix+"WriteEvent")
	defer span.End()
	// TODO: validate key ?
	if err := b.Init(); err != nil {
		return 0, err
	}
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
	err := b.sqlDB.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		// TODO: Set the Labels

		// 1. Insert into resource
		if _, err := exec(ctx, tx, sqlResourceInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.sqlDialect),
			WriteEvent:  event,
			GUID:        guid,
		}); err != nil {
			return fmt.Errorf("insert into resource: %w", err)
		}

		// 2. Insert into resource history
		if _, err := exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.sqlDialect),
			WriteEvent:  event,
			GUID:        guid,
		}); err != nil {
			return fmt.Errorf("insert into resource history: %w", err)
		}

		// 3. TODO: Rebuild the whole folder tree structure if we're creating a folder

		// 4. Atomically increpement resource version for this kind
		rv, err := resourceVersionAtomicInc(ctx, tx, b.sqlDialect, event.Key)
		if err != nil {
			return err
		}
		newVersion = rv

		// 5. Update the RV in both resource and resource_history
		if _, err = exec(ctx, tx, sqlResourceHistoryUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate:     sqltemplate.New(b.sqlDialect),
			GUID:            guid,
			ResourceVersion: newVersion,
		}); err != nil {
			return fmt.Errorf("update history rv: %w", err)
		}
		if _, err = exec(ctx, tx, sqlResourceUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate:     sqltemplate.New(b.sqlDialect),
			GUID:            guid,
			ResourceVersion: newVersion,
		}); err != nil {
			return fmt.Errorf("update resource rv: %w", err)
		}
		return nil
	})

	return newVersion, err
}

func (b *backend) update(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := b.tracer.Start(ctx, trace_prefix+"Update")
	defer span.End()
	var newVersion int64
	guid := uuid.New().String()
	err := b.sqlDB.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		// TODO: Set the Labels

		// 1. Update into resource
		res, err := exec(ctx, tx, sqlResourceUpdate, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.sqlDialect),
			WriteEvent:  event,
			GUID:        guid,
		})
		if err != nil {
			return fmt.Errorf("update into resource: %w", err)
		}

		count, err := res.RowsAffected()
		if err != nil {
			return fmt.Errorf("update into resource: %w", err)
		}
		if count == 0 {
			return fmt.Errorf("no rows affected")
		}

		// 2. Insert into resource history
		if _, err := exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.sqlDialect),
			WriteEvent:  event,
			GUID:        guid,
		}); err != nil {
			return fmt.Errorf("insert into resource history: %w", err)
		}

		// 3. TODO: Rebuild the whole folder tree structure if we're creating a folder

		// 4. Atomically increpement resource version for this kind
		rv, err := resourceVersionAtomicInc(ctx, tx, b.sqlDialect, event.Key)
		if err != nil {
			return err
		}
		newVersion = rv

		// 5. Update the RV in both resource and resource_history
		if _, err = exec(ctx, tx, sqlResourceHistoryUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate:     sqltemplate.New(b.sqlDialect),
			GUID:            guid,
			ResourceVersion: newVersion,
		}); err != nil {
			return fmt.Errorf("update history rv: %w", err)
		}
		if _, err = exec(ctx, tx, sqlResourceUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate:     sqltemplate.New(b.sqlDialect),
			GUID:            guid,
			ResourceVersion: newVersion,
		}); err != nil {
			return fmt.Errorf("update resource rv: %w", err)
		}

		return nil
	})

	return newVersion, err
}

func (b *backend) delete(ctx context.Context, event resource.WriteEvent) (int64, error) {
	ctx, span := b.tracer.Start(ctx, trace_prefix+"Delete")
	defer span.End()
	var newVersion int64
	guid := uuid.New().String()

	err := b.sqlDB.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		// TODO: Set the Labels

		// 1. delete from resource
		res, err := exec(ctx, tx, sqlResourceDelete, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.sqlDialect),
			WriteEvent:  event,
			GUID:        guid,
		})
		if err != nil {
			return fmt.Errorf("delete resource: %w", err)
		}
		count, err := res.RowsAffected()
		if err != nil {
			return fmt.Errorf("delete resource: %w", err)
		}
		if count == 0 {
			return fmt.Errorf("no rows affected")
		}

		// 2. Add  event to resource history
		if _, err := exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
			SQLTemplate: sqltemplate.New(b.sqlDialect),
			WriteEvent:  event,
			GUID:        guid,
		}); err != nil {
			return fmt.Errorf("insert into resource history: %w", err)
		}

		// 3. TODO: Rebuild the whole folder tree structure if we're creating a folder

		// 4. Atomically increpement resource version for this kind
		newVersion, err = resourceVersionAtomicInc(ctx, tx, b.sqlDialect, event.Key)
		if err != nil {
			return err
		}

		// 5. Update the RV in resource_history
		if _, err = exec(ctx, tx, sqlResourceHistoryUpdateRV, sqlResourceUpdateRVRequest{
			SQLTemplate:     sqltemplate.New(b.sqlDialect),
			GUID:            guid,
			ResourceVersion: newVersion,
		}); err != nil {
			return fmt.Errorf("update history rv: %w", err)
		}
		return nil
	})

	return newVersion, err
}

func (b *backend) Read(ctx context.Context, req *resource.ReadRequest) (*resource.ReadResponse, error) {
	_, span := b.tracer.Start(ctx, trace_prefix+".Read")
	defer span.End()

	// TODO: validate key ?
	if err := b.Init(); err != nil {
		return nil, err
	}

	readReq := sqlResourceReadRequest{
		SQLTemplate:  sqltemplate.New(b.sqlDialect),
		Request:      req,
		readResponse: new(readResponse),
	}

	sr := sqlResourceRead
	if req.ResourceVersion > 0 {
		// read a specific version
		sr = sqlResourceHistoryRead
	}

	res, err := queryRow(ctx, b.sqlDB, sr, readReq)
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

	if req.ResourceVersion > 0 || req.NextPageToken != "" {
		return b.listAtRevision(ctx, req)
	}
	return b.listLatest(ctx, req)
}

// listLatest fetches the resources from the resource table.
func (b *backend) listLatest(ctx context.Context, req *resource.ListRequest) (*resource.ListResponse, error) {
	out := &resource.ListResponse{
		Items:           []*resource.ResourceWrapper{}, // TODO: we could pre-allocate the capacity if we estimate the number of items
		ResourceVersion: 0,
	}

	err := b.sqlDB.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		var err error

		out.ResourceVersion, err = fetchLatestRV(ctx, tx, b.sqlDialect, req.Options.Key.Group, req.Options.Key.Resource)
		if err != nil {
			return err
		}

		listReq := sqlResourceListRequest{
			SQLTemplate: sqltemplate.New(b.sqlDialect),
			Request:     new(resource.ListRequest),
			Response:    new(resource.ResourceWrapper),
		}
		*listReq.Request = *req
		if req.Limit > 0 {
			listReq.Request.Limit++ // fetch one extra row for Limit
		}

		items, err := query(ctx, tx, sqlResourceList, listReq)
		if err != nil {
			return fmt.Errorf("list latest resources: %w", err)
		}

		if req.Limit > 0 && int(req.Limit) < len(items) {
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
		Items:           []*resource.ResourceWrapper{}, // TODO: we could pre-allocate the capacity if we estimate the number of items
		ResourceVersion: rv,
	}

	err := b.sqlDB.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		listReq := sqlResourceHistoryListRequest{
			SQLTemplate: sqltemplate.New(b.sqlDialect),
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

		items, err := query(ctx, tx, sqlResourceHistoryList, listReq)
		if err != nil {
			return fmt.Errorf("list resources at revision: %w", err)
		}

		if req.Limit > 0 && int(req.Limit) < len(items) {
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
	if err := b.Init(); err != nil {
		return nil, err
	}
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
		SQLTemplate:          sqltemplate.New(b.sqlDialect),
		groupResourceVersion: new(groupResourceVersion),
	}
	query, err := sqltemplate.Execute(sqlResourceVersionList, reqRVs)
	if err != nil {
		return nil, fmt.Errorf("execute SQL template to get the latest resource version: %w", err)
	}
	rows, err := b.sqlDB.QueryContext(ctx, query, reqRVs.GetArgs()...)
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
	res, err := queryRow(ctx, x, sqlResourceVersionGet, sqlResourceVersionRequest{
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
		SQLTemplate:          sqltemplate.New(b.sqlDialect),
		Resource:             res,
		Group:                grp,
		SinceResourceVersion: since,
		Response:             &historyPollResponse{},
	}
	query, err := sqltemplate.Execute(sqlResourceHistoryPoll, pollReq)
	if err != nil {
		return since, fmt.Errorf("execute SQL template to poll for resource history: %w", err)
	}

	rows, err := b.sqlDB.QueryContext(ctx, query, pollReq.GetArgs()...)
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
	req := sqlResourceVersionRequest{
		SQLTemplate:     sqltemplate.New(d),
		Group:           key.Group,
		Resource:        key.Resource,
		resourceVersion: new(resourceVersion),
	}
	rv, err := queryRow(ctx, x, sqlResourceVersionGet, req)

	if errors.Is(err, sql.ErrNoRows) {
		// if there wasn't a row associated with the given resource, we create one with
		// version 1
		if _, err = exec(ctx, x, sqlResourceVersionInsert, sqlResourceVersionRequest{
			SQLTemplate: sqltemplate.New(d),
			Group:       key.Group,
			Resource:    key.Resource,
		}); err != nil {
			return 0, fmt.Errorf("insert into resource_version: %w", err)
		}
		return 1, nil
	}
	if err != nil {
		return 0, fmt.Errorf("increase resource version: %w", err)
	}
	nextRV := rv.ResourceVersion + 1
	// 2. Increment the resource version
	res, err := exec(ctx, x, sqlResourceVersionInc, sqlResourceVersionRequest{
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

	if count, err := res.RowsAffected(); err != nil || count == 0 {
		return 0, fmt.Errorf("increase resource version did not affect any rows: %w", err)
	}

	// 3. Retun the incremended value
	return nextRV, nil
}

// exec uses `req` as input for a non-data returning query generated with
// `tmpl`, and executed in `x`.
func exec(ctx context.Context, x db.ContextExecer, tmpl *template.Template, req sqltemplate.SQLTemplateIface) (sql.Result, error) {
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("exec: invalid request for template %q: %w",
			tmpl.Name(), err)
	}

	rawQuery, err := sqltemplate.Execute(tmpl, req)
	if err != nil {
		return nil, fmt.Errorf("execute template: %w", err)
	}
	query := sqltemplate.FormatSQL(rawQuery)

	res, err := x.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, SQLError{
			Err:          err,
			CallType:     "Exec",
			TemplateName: tmpl.Name(),
			arguments:    req.GetArgs(),
			Query:        query,
			RawQuery:     rawQuery,
		}
	}

	return res, nil
}

// query uses `req` as input for a set-returning query generated with `tmpl`,
// and executed in `x`. The `Results` method of `req` should return a deep copy
// since it will be used multiple times to decode each value.
func query[T any](ctx context.Context, x db.ContextExecer, tmpl *template.Template, req sqltemplate.WithResults[T]) ([]T, error) {
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("query: invalid request for template %q: %w",
			tmpl.Name(), err)
	}

	rawQuery, err := sqltemplate.Execute(tmpl, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", tmpl.Name(), err)
	}
	query := sqltemplate.FormatSQL(rawQuery)

	rows, err := x.QueryContext(ctx, query, req.GetArgs()...)
	if errors.Is(err, sql.ErrNoRows) {
		return []T{}, nil
	}
	if err != nil {
		return nil, SQLError{
			Err:          err,
			CallType:     "Query",
			TemplateName: tmpl.Name(),
			arguments:    req.GetArgs(),
			ScanDest:     req.GetScanDest(),
			Query:        query,
			RawQuery:     rawQuery,
		}
	}

	ret := []T{}
	for rows.Next() {
		v, err := scanRow(rows, req)
		if err != nil {
			return nil, fmt.Errorf("scan %d-eth value: %w", len(ret)+1, err)
		}
		ret = append(ret, v)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error after reading %d values: %w",
			len(ret), err)
	}
	// rows.Close() is not necessary. See that method's docs for more info

	return ret, nil
}

// queryRow uses `req` as input and output for a single-row returning query
// generated with `tmpl`, and executed in `x`.
func queryRow[T any](ctx context.Context, x db.ContextExecer, tmpl *template.Template, req sqltemplate.WithResults[T]) (T, error) {
	var zero T

	if err := req.Validate(); err != nil {
		return zero, fmt.Errorf("queryRow: invalid request for template %q: %w",
			tmpl.Name(), err)
	}

	rawQuery, err := sqltemplate.Execute(tmpl, req)
	if err != nil {
		return zero, fmt.Errorf("execute template %q: %w", tmpl.Name(), err)
	}
	query := sqltemplate.FormatSQL(rawQuery)

	row := x.QueryRowContext(ctx, query, req.GetArgs()...)
	if err := row.Err(); err != nil {
		return zero, SQLError{
			Err:          err,
			CallType:     "QueryRow",
			TemplateName: tmpl.Name(),
			arguments:    req.GetArgs(),
			ScanDest:     req.GetScanDest(),
			Query:        query,
			RawQuery:     rawQuery,
		}
	}

	return scanRow(row, req)
}

type scanner interface {
	Scan(dest ...any) error
}

// scanRow is used on *sql.Row and *sql.Rows, and is factored out here not to
// improving code reuse, but rather for ease of testing.
func scanRow[T any](sc scanner, req sqltemplate.WithResults[T]) (zero T, err error) {
	if err = sc.Scan(req.GetScanDest()...); err != nil {
		return zero, fmt.Errorf("row scan: %w", err)
	}

	res, err := req.Results()
	if err != nil {
		return zero, fmt.Errorf("row results: %w", err)
	}

	return res, nil
}
