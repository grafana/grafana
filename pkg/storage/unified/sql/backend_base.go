package sql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"iter"
	"math"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// baseBackend contains shared database infrastructure and read operations.
// It implements resource.StorageReader and provides lifecycle management.
type baseBackend struct {
	// server lifecycle
	done     <-chan struct{}
	cancel   context.CancelFunc
	initOnce sync.Once
	initErr  error

	// o11y
	log            logging.Logger
	reg            prometheus.Registerer
	storageMetrics *resource.StorageMetrics

	// database
	dbProvider db.DBProvider
	db         db.DB
	dialect    sqltemplate.Dialect
}

// baseBackendOptions contains options for creating a baseBackend.
type baseBackendOptions struct {
	DBProvider     db.DBProvider
	Reg            prometheus.Registerer
	StorageMetrics *resource.StorageMetrics
}

// newBaseBackend creates a new base backend with shared infrastructure.
func newBaseBackend(opts baseBackendOptions) (*baseBackend, error) {
	if opts.DBProvider == nil {
		return nil, errors.New("no db provider")
	}
	ctx, cancel := context.WithCancel(context.Background())

	return &baseBackend{
		done:           ctx.Done(),
		cancel:         cancel,
		log:            logging.DefaultLogger.With("logger", "sql-resource-server"),
		reg:            opts.Reg,
		dbProvider:     opts.DBProvider,
		storageMetrics: opts.StorageMetrics,
	}, nil
}

// Init initializes the base backend (database connection, dialect, RV manager).
func (b *baseBackend) Init(ctx context.Context) error {
	b.initOnce.Do(func() {
		b.initErr = b.initLocked(ctx)
	})
	return b.initErr
}

func (b *baseBackend) initLocked(ctx context.Context) error {
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

	return nil
}

// Stop stops the base backend.
func (b *baseBackend) Stop(_ context.Context) error {
	b.cancel()
	return nil
}

// IsHealthy checks if the database connection is healthy.
func (b *baseBackend) IsHealthy(ctx context.Context, _ *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	if err := b.db.PingContext(ctx); err != nil {
		return nil, err
	}
	return &resourcepb.HealthCheckResponse{Status: resourcepb.HealthCheckResponse_SERVING}, nil
}

// ReadResource implements resource.StorageReader.
func (b *baseBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *resource.BackendReadResponse {
	_, span := tracer.Start(ctx, "sql.backend.ReadResource")
	defer span.End()

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

// ListIterator implements resource.StorageReader.
func (b *baseBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.ListIterator")
	defer span.End()

	if err := resource.MigrateListRequestVersionMatch(req, b.log); err != nil {
		return 0, err
	}

	if req.Options == nil || req.Options.Key.Group == "" || req.Options.Key.Resource == "" {
		return 0, fmt.Errorf("missing group or resource")
	}

	if req.ResourceVersion > 0 || req.NextPageToken != "" {
		return b.listAtRevision(ctx, req, cb)
	}
	return b.listLatest(ctx, req, cb)
}

// ListHistory implements resource.StorageReader.
func (b *baseBackend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.ListHistory")
	defer span.End()

	return b.getHistory(ctx, req, cb)
}

// readHistory fetches the resource history from the resource_history table.
func (b *baseBackend) readHistory(ctx context.Context, key *resourcepb.ResourceKey, rv int64) *resource.BackendReadResponse {
	_, span := tracer.Start(ctx, "sql.backend.readHistory")
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

// listLatest fetches the resources from the resource table.
func (b *baseBackend) listLatest(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.listLatest")
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

// listAtRevision fetches the resources from the resource_history table at a specific revision.
func (b *baseBackend) listAtRevision(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.listAtRevision")
	defer span.End()

	// Get the RV
	iter := &listIter{listRV: req.ResourceVersion, sortAsc: false}
	if req.NextPageToken != "" {
		continueToken, err := GetContinueToken(req.NextPageToken)
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

	// The query below has the potential to be EXTREMELY slow if the resource_history table is big.
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

// getHistory fetches the resource history from the resource_history table.
func (b *baseBackend) getHistory(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.getHistory")
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
		continueToken, err := GetContinueToken(req.NextPageToken)
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

// fetchLatestRV returns the current maximum RV in the resource table
func (b *baseBackend) fetchLatestRV(ctx context.Context, x db.ContextExecer, d sqltemplate.Dialect, group, resource string) (int64, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.fetchLatestRV")
	defer span.End()
	res, err := dbutil.QueryRow(ctx, x, rvmanager.SqlResourceVersionGet, rvmanager.SqlResourceVersionGetRequest{
		SQLTemplate: sqltemplate.New(d),
		Group:       group,
		Resource:    resource,
		ReadOnly:    true,
		Response:    new(rvmanager.ResourceVersionResponse),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return 1, nil
	} else if err != nil {
		return 0, fmt.Errorf("get resource version: %w", err)
	}
	return res.ResourceVersion, nil
}

// fetchLatestHistoryRV returns the current maximum RV in the resource_history table
func (b *baseBackend) fetchLatestHistoryRV(ctx context.Context, x db.ContextExecer, d sqltemplate.Dialect, key *resourcepb.ResourceKey, eventType resourcepb.WatchEvent_Type) (int64, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.fetchLatestHistoryRV")
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

func (b *baseBackend) WriteEvent(ctx context.Context, event resource.WriteEvent) (int64, error) {
	return 0, fmt.Errorf("WriteEvent not supported on base backend")
}

func (b *baseBackend) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	return nil, fmt.Errorf("WatchWriteEvents not supported on base backend")
}

func (b *baseBackend) GetResourceStats(ctx context.Context, nsr resource.NamespacedResource, minCount int) ([]resource.ResourceStats, error) {
	return nil, fmt.Errorf("GetResourceStats not supported on base backend")
}

func (b *baseBackend) GetResourceLastImportTimes(ctx context.Context) iter.Seq2[resource.ResourceLastImportTime, error] {
	return func(yield func(resource.ResourceLastImportTime, error) bool) {
		yield(resource.ResourceLastImportTime{}, errors.New("GetResourceLastImportTimes not supported on base backend"))
	}
}

func (b *baseBackend) ListModifiedSince(ctx context.Context, key resource.NamespacedResource, sinceRv int64) (int64, iter.Seq2[*resource.ModifiedResource, error]) {
	return 0, func(yield func(*resource.ModifiedResource, error) bool) {
		yield(nil, fmt.Errorf("ListModifiedSince not supported on base backend"))
	}
}
