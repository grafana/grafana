package sqlstash

import (
	"context"
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
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Package-level errors.
var (
	ErrNotImplementedYet = errors.New("not implemented yet")
)

// Make sure we implement both store and search
var _ resource.ResourceStoreServer = &sqlResourceServer{}
var _ resource.ResourceSearchServer = &sqlResourceServer{}

func ProvideSQLResourceServer(db db.EntityDBInterface, tracer tracing.Tracer) (SqlResourceServer, error) {
	ctx, cancel := context.WithCancel(context.Background())

	var err error
	server := &sqlResourceServer{
		db:     db,
		log:    log.New("sql-resource-server"),
		ctx:    ctx,
		cancel: cancel,
		tracer: tracer,
	}
	server.writer, err = resource.NewResourceWriter(resource.WriterOptions{
		NodeID:   123, // for snowflake ID generation
		Tracer:   tracer,
		Reader:   server.Read,
		Appender: server.append,
	})
	if err != nil {
		return nil, err
	}

	if err := prometheus.Register(sqlstash.NewStorageMetrics()); err != nil {
		server.log.Warn("error registering storage server metrics", "error", err)
	}

	return server, nil
}

type SqlResourceServer interface {
	resource.ResourceStoreServer
	resource.ResourceSearchServer

	Init() error
	Stop()
}

type sqlResourceServer struct {
	log         log.Logger
	db          db.EntityDBInterface // needed to keep xorm engine in scope
	sess        *session.SessionDB
	dialect     migrator.Dialect
	broadcaster sqlstash.Broadcaster[*resource.WatchResponse]
	ctx         context.Context // TODO: remove
	cancel      context.CancelFunc
	stream      chan *resource.WatchResponse
	tracer      trace.Tracer

	// Wrapper around all write events
	writer resource.ResourceWriter

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
	s.writer, err = resource.NewResourceWriter(resource.WriterOptions{
		NodeID:   10,
		Tracer:   s.tracer,
		Reader:   s.Read,
		Appender: s.append,
	})
	if err != nil {
		return err
	}

	// set up the broadcaster
	s.broadcaster, err = sqlstash.NewBroadcaster(s.ctx, func(stream chan *resource.WatchResponse) error {
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

func (s *sqlResourceServer) IsHealthy(ctx context.Context, r *resource.HealthCheckRequest) (*resource.HealthCheckResponse, error) {
	ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "isHealthy"}))
	if err := s.Init(); err != nil {
		ctxLogger.Error("init error", "error", err)
		return nil, err
	}

	if err := s.sqlDB.PingContext(ctx); err != nil {
		return nil, err
	}
	// TODO: check the status of the watcher implementation as well
	return &resource.HealthCheckResponse{Status: resource.HealthCheckResponse_SERVING}, nil
}

func (s *sqlResourceServer) Stop() {
	s.cancel()
}

func (s *sqlResourceServer) append(ctx context.Context, event *resource.WriteEvent) (int64, error) {
	_, span := s.tracer.Start(ctx, "storage_server.WriteEvent")
	defer span.End()

	// TODO... actually write write the event!

	return 0, ErrNotImplementedYet
}

func (s *sqlResourceServer) Read(ctx context.Context, req *resource.ReadRequest) (*resource.ReadResponse, error) {
	_, span := s.tracer.Start(ctx, "storage_server.GetResource")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	if req.Key.Group == "" {
		return &resource.ReadResponse{Status: badRequest("missing group")}, nil
	}
	if req.Key.Resource == "" {
		return &resource.ReadResponse{Status: badRequest("missing resource")}, nil
	}

	fmt.Printf("TODO, GET: %+v", req.Key)

	return nil, ErrNotImplementedYet
}

func (s *sqlResourceServer) Create(ctx context.Context, req *resource.CreateRequest) (*resource.CreateResponse, error) {
	rsp, err := s.writer.Create(ctx, req)
	if err != nil {
		s.log.Info("create", "error", err)
		rsp.Status = &resource.StatusResult{
			Status:  "Failure",
			Message: err.Error(),
		}
	}
	return rsp, nil
}

func (s *sqlResourceServer) Update(ctx context.Context, req *resource.UpdateRequest) (*resource.UpdateResponse, error) {
	rsp, err := s.writer.Update(ctx, req)
	if err != nil {
		s.log.Info("create", "error", err)
		rsp.Status = &resource.StatusResult{
			Status:  "Failure",
			Message: err.Error(),
		}
	}
	return rsp, nil
}

func (s *sqlResourceServer) Delete(ctx context.Context, req *resource.DeleteRequest) (*resource.DeleteResponse, error) {
	rsp, err := s.writer.Delete(ctx, req)
	if err != nil {
		s.log.Info("create", "error", err)
		rsp.Status = &resource.StatusResult{
			Status:  "Failure",
			Message: err.Error(),
		}
	}
	return rsp, nil
}

func (s *sqlResourceServer) List(ctx context.Context, req *resource.ListRequest) (*resource.ListResponse, error) {
	_, span := s.tracer.Start(ctx, "storage_server.List")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	fmt.Printf("TODO, LIST: %+v", req.Options.Key)

	return nil, ErrNotImplementedYet
}

// Get the raw blob bytes and metadata
func (s *sqlResourceServer) GetBlob(ctx context.Context, req *resource.GetBlobRequest) (*resource.GetBlobResponse, error) {
	_, span := s.tracer.Start(ctx, "storage_server.List")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	fmt.Printf("TODO, GET BLOB: %+v", req.Key)

	return nil, ErrNotImplementedYet
}

// Show resource history (and trash)
func (s *sqlResourceServer) History(ctx context.Context, req *resource.HistoryRequest) (*resource.HistoryResponse, error) {
	_, span := s.tracer.Start(ctx, "storage_server.History")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	fmt.Printf("TODO, GET History: %+v", req.Key)

	return nil, ErrNotImplementedYet
}

// Used for efficient provisioning
func (s *sqlResourceServer) Origin(ctx context.Context, req *resource.OriginRequest) (*resource.OriginResponse, error) {
	_, span := s.tracer.Start(ctx, "storage_server.History")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	fmt.Printf("TODO, GET History: %+v", req.Key)

	return nil, ErrNotImplementedYet
}
