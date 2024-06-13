package sqlstash

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified"
)

const resoruceTable = "resource"
const resourceVersionTable = "resource_version"

// Package-level errors.
var (
	ErrNotFound                  = errors.New("entity not found")
	ErrOptimisticLockingFailed   = errors.New("optimistic locking failed")
	ErrUserNotFoundInContext     = errors.New("user not found in context")
	ErrNextPageTokenNotSupported = errors.New("nextPageToken not yet supported")
	ErrLimitNotSupported         = errors.New("limit not yet supported")
	ErrNotImplementedYet         = errors.New("not implemented yet")
)

// Make sure we implement correct interfaces
var _ unified.ResourceStoreServer = &sqlResourceServer{}

func ProvideSQLResourceServer(db db.EntityDBInterface, tracer tracing.Tracer) (SqlResourceServer, error) {
	ctx, cancel := context.WithCancel(context.Background())

	server := &sqlResourceServer{
		db:     db,
		log:    log.New("sql-resource-server"),
		ctx:    ctx,
		cancel: cancel,
		tracer: tracer,
	}

	if err := prometheus.Register(sqlstash.NewStorageMetrics()); err != nil {
		server.log.Warn("error registering storage server metrics", "error", err)
	}

	return server, nil
}

type SqlResourceServer interface {
	unified.ResourceStoreServer

	Init() error
	Stop()
}

type sqlResourceServer struct {
	log         log.Logger
	db          db.EntityDBInterface // needed to keep xorm engine in scope
	sess        *session.SessionDB
	dialect     migrator.Dialect
	broadcaster sqlstash.Broadcaster[*unified.WatchResponse]
	ctx         context.Context // TODO: remove
	cancel      context.CancelFunc
	stream      chan *unified.WatchResponse
	tracer      trace.Tracer
	validator   unified.EventValidator

	once    sync.Once
	initErr error

	sqlDB      db.DB
	sqlDialect sqltemplate.Dialect
}

func (s *sqlResourceServer) Init() error {
	s.once.Do(func() {
		s.initErr = s.init()
	})

	if s.initErr != nil {
		return fmt.Errorf("initialize Entity Server: %w", s.initErr)
	}

	return s.initErr
}

func (s *sqlResourceServer) init() error {
	if s.sess != nil {
		return nil
	}

	if s.db == nil {
		return errors.New("missing db")
	}

	err := s.db.Init()
	if err != nil {
		return err
	}

	sqlDB, err := s.db.GetDB()
	if err != nil {
		return err
	}
	s.sqlDB = sqlDB

	driverName := sqlDB.DriverName()
	driverName = strings.TrimSuffix(driverName, "WithHooks")
	switch driverName {
	case db.DriverMySQL:
		s.sqlDialect = sqltemplate.MySQL
	case db.DriverPostgres:
		s.sqlDialect = sqltemplate.PostgreSQL
	case db.DriverSQLite, db.DriverSQLite3:
		s.sqlDialect = sqltemplate.SQLite
	default:
		return fmt.Errorf("no dialect for driver %q", driverName)
	}

	sess, err := s.db.GetSession()
	if err != nil {
		return err
	}

	engine, err := s.db.GetEngine()
	if err != nil {
		return err
	}

	s.sess = sess
	s.dialect = migrator.NewDialect(engine.DriverName())
	s.validator = unified.NewEventValidator(unified.EventValidatorOptions{
		// use snowflake IDs
	})

	// set up the broadcaster
	s.broadcaster, err = sqlstash.NewBroadcaster(s.ctx, func(stream chan *unified.WatchResponse) error {
		s.stream = stream

		// start the poller
		go s.poller(stream)

		return nil
	})
	if err != nil {
		return err
	}

	return nil
}

func (s *sqlResourceServer) IsHealthy(ctx context.Context, r *unified.HealthCheckRequest) (*unified.HealthCheckResponse, error) {
	ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "isHealthy"}))
	if err := s.Init(); err != nil {
		ctxLogger.Error("init error", "error", err)
		return nil, err
	}

	if err := s.sqlDB.PingContext(ctx); err != nil {
		return nil, err
	}
	// TODO: check the status of the watcher implementation as well
	return &unified.HealthCheckResponse{Status: unified.HealthCheckResponse_SERVING}, nil
}

func (s *sqlResourceServer) Stop() {
	s.cancel()
}

func (s *sqlResourceServer) GetResource(ctx context.Context, req *unified.GetResourceRequest) (*unified.GetResourceResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.GetResource")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	if req.Key.Group == "" {
		return &unified.GetResourceResponse{Status: badRequest("missing group")}, nil
	}
	if req.Key.Resource == "" {
		return &unified.GetResourceResponse{Status: badRequest("missing resource")}, nil
	}

	fmt.Printf("TODO, GET: %+v", req.Key)

	return nil, ErrNotImplementedYet
}

func (s *sqlResourceServer) Create(ctx context.Context, req *unified.CreateRequest) (*unified.CreateResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Create")
	defer span.End()

	if req.Key.ResourceVersion > 0 {
		return &unified.CreateResponse{
			Status: badRequest("can not update a specific resource version"),
		}, nil
	}

	if err := s.Init(); err != nil {
		return nil, err
	}

	event, err := s.validator.PrepareCreate(ctx, req)
	if err != nil {
		return nil, err
	}
	if event.Status != nil {
		return &unified.CreateResponse{Status: event.Status}, nil
	}

	fmt.Printf("TODO, CREATE: %v", event)

	return nil, ErrNotImplementedYet
}

func (s *sqlResourceServer) Update(ctx context.Context, req *unified.UpdateRequest) (*unified.UpdateResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Update")
	defer span.End()

	if req.Key.ResourceVersion < 0 {
		return &unified.UpdateResponse{
			Status: badRequest("update must include the previous version"),
		}, nil
	}

	if err := s.Init(); err != nil {
		return nil, err
	}

	latest, err := s.GetResource(ctx, &unified.GetResourceRequest{
		Key: req.Key.WithoutResourceVersion(),
	})
	if err != nil {
		return nil, err
	}
	event, err := s.validator.PrepareUpdate(ctx, req, latest)
	if err != nil {
		return nil, err
	}
	if event.Status != nil {
		return &unified.UpdateResponse{Status: event.Status}, nil
	}

	fmt.Printf("TODO, UPDATE: %v", event)

	return nil, ErrNotImplementedYet
}

func (s *sqlResourceServer) Delete(ctx context.Context, req *unified.DeleteRequest) (*unified.DeleteResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Delete")
	defer span.End()

	if req.Key.ResourceVersion < 0 {
		return &unified.DeleteResponse{
			Status: badRequest("update must include the previous version"),
		}, nil
	}

	if err := s.Init(); err != nil {
		return nil, err
	}

	latest, err := s.GetResource(ctx, &unified.GetResourceRequest{
		Key: req.Key.WithoutResourceVersion(),
	})
	if err != nil {
		return nil, err
	}
	event, err := s.validator.PrepareDelete(ctx, req, latest)
	if err != nil {
		return nil, err
	}
	if event.Status != nil {
		return &unified.DeleteResponse{Status: event.Status}, nil
	}

	fmt.Printf("TODO, DELETE: %+v ", req.Key)

	return nil, ErrNotImplementedYet
}

func (s *sqlResourceServer) List(ctx context.Context, req *unified.ListRequest) (*unified.ListResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.List")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	var rv int64
	err := s.sqlDB.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		req := sqlResourceVersionGetRequest{
			SQLTemplate:            sqltemplate.New(s.sqlDialect),
			Group:                  req.Options.Key.Group,
			Resource:               req.Options.Key.Resource,
			returnsResourceVersion: new(returnsResourceVersion),
		}
		res, err := queryRow(ctx, tx, sqlResourceVersionGet, req)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if res != nil {
			rv = res.ResourceVersion
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	fmt.Printf("TODO, LIST: %+v // %d", req.Options.Key, rv)

	return nil, ErrNotImplementedYet
}

// Get the raw blob bytes and metadata
func (s *sqlResourceServer) GetBlob(ctx context.Context, req *unified.GetBlobRequest) (*unified.GetBlobResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.List")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	fmt.Printf("TODO, GET BLOB: %+v", req.Key)

	return nil, ErrNotImplementedYet
}

// Show resource history (and trash)
func (s *sqlResourceServer) History(ctx context.Context, req *unified.HistoryRequest) (*unified.HistoryResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.History")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	fmt.Printf("TODO, GET History: %+v", req.Key)

	return nil, ErrNotImplementedYet
}

// Used for efficient provisioning
func (s *sqlResourceServer) Origin(ctx context.Context, req *unified.OriginRequest) (*unified.OriginResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.History")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	fmt.Printf("TODO, GET History: %+v", req.Key)

	return nil, ErrNotImplementedYet
}
