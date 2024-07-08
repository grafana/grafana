package sqlnext

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Package-level errors.
var (
	ErrNotImplementedYet = errors.New("not implemented yet (sqlnext)")
)

func ProvideSQLResourceServer(db db.EntityDBInterface, tracer tracing.Tracer) (resource.ResourceServer, error) {
	ctx, cancel := context.WithCancel(context.Background())

	store := &sqlResourceStore{
		db:     db,
		log:    log.New("sql-resource-server"),
		ctx:    ctx,
		cancel: cancel,
		tracer: tracer,
	}

	if err := prometheus.Register(sqlstash.NewStorageMetrics()); err != nil {
		return nil, err
	}

	return resource.NewResourceServer(resource.ResourceServerOptions{
		Tracer:      tracer,
		Backend:     store,
		Diagnostics: store,
		Lifecycle:   store,
	})
}

type sqlResourceStore struct {
	log     log.Logger
	db      db.EntityDBInterface // needed to keep xorm engine in scope
	sess    *session.SessionDB
	dialect migrator.Dialect
	ctx     context.Context // TODO: remove
	cancel  context.CancelFunc
	tracer  trace.Tracer

	//broadcaster sqlstash.Broadcaster[*resource.WatchEvent]
	//stream chan *resource.WatchEvent

	sqlDB      db.DB
	sqlDialect sqltemplate.Dialect
}

func (s *sqlResourceStore) Init() error {
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

	// TODO.... set up the broadcaster

	return nil
}

func (s *sqlResourceStore) IsHealthy(ctx context.Context, r *resource.HealthCheckRequest) (*resource.HealthCheckResponse, error) {
	// ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "isHealthy"}))

	if err := s.sqlDB.PingContext(ctx); err != nil {
		return nil, err
	}
	// TODO: check the status of the watcher implementation as well
	return &resource.HealthCheckResponse{Status: resource.HealthCheckResponse_SERVING}, nil
}

func (s *sqlResourceStore) Stop() {
	s.cancel()
}

func (s *sqlResourceStore) WriteEvent(ctx context.Context, event resource.WriteEvent) (int64, error) {
	_, span := s.tracer.Start(ctx, "storage_server.WriteEvent")
	defer span.End()

	// TODO... actually write write the event!

	return 0, ErrNotImplementedYet
}

func (s *sqlResourceStore) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	return nil, ErrNotImplementedYet
}

func (s *sqlResourceStore) Read(ctx context.Context, req *resource.ReadRequest) (*resource.ReadResponse, error) {
	_, span := s.tracer.Start(ctx, "storage_server.GetResource")
	defer span.End()

	fmt.Printf("TODO, GET: %+v", req.Key)

	return nil, ErrNotImplementedYet
}

func (s *sqlResourceStore) PrepareList(ctx context.Context, req *resource.ListRequest) (*resource.ListResponse, error) {
	_, span := s.tracer.Start(ctx, "storage_server.List")
	defer span.End()

	fmt.Printf("TODO, LIST: %+v", req.Options.Key)

	return nil, ErrNotImplementedYet
}
