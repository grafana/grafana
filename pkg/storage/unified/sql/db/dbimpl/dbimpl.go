package dbimpl

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/dlmiddlecote/sqlstats"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util/xorm"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/otel"
)

const (
	dbTypeMySQL    = "mysql"
	dbTypePostgres = "postgres"
	dbTypeSQLite   = "sqlite3"
)

const grafanaDBInstrumentQueriesKey = "instrument_queries"

var errGrafanaDBInstrumentedNotSupported = errors.New("the Resource API is " +
	"attempting to leverage the database from core Grafana defined in the" +
	" [database] INI section since a database configuration was not provided" +
	" in the [resource_api] section. But we detected that the key" +
	" `instrument_queries` is enabled in [database], and that" +
	" setup is currently unsupported. Please, consider disabling that flag")

func ProvideResourceDB(grafanaDB infraDB.DB, cfg *setting.Cfg, tracer trace.Tracer) (db.DBProvider, error) {
	if tracer == nil {
		tracer = noop.NewTracerProvider().Tracer("test-tracer")
	}
	p, err := newResourceDBProvider(grafanaDB, cfg, tracer)
	if err != nil {
		return nil, fmt.Errorf("provide Resource DB: %w", err)
	}
	return p, nil
}

type resourceDBProvider struct {
	engine          *xorm.Engine
	cfg             *setting.Cfg
	log             log.Logger
	migrateFunc     func(context.Context, *xorm.Engine, *setting.Cfg) error
	tracer          trace.Tracer
	registerMetrics bool
	logQueries      bool

	once       sync.Once
	resourceDB db.DB
	initErr    error
}

func newResourceDBProvider(grafanaDB infraDB.DB, cfg *setting.Cfg, tracer trace.Tracer) (*resourceDBProvider, error) {
	logger := log.New("resource-db")
	p := &resourceDBProvider{
		cfg:         cfg,
		log:         logger,
		migrateFunc: migrations.MigrateResourceStore,
		tracer:      tracer,
	}

	dbType := cfg.SectionWithEnvOverrides("database").Key("type").String()

	switch {
	case dbType != "":
		logger.Info("Using database section", "db_type", dbType)
		dbCfg, err := sqlstore.NewDatabaseConfig(cfg, nil)
		if err != nil {
			return nil, err
		}
		p.registerMetrics = true
		p.engine, err = getEngine(dbCfg)
		return p, err
	case grafanaDB != nil:
		// Try to use the grafana db connection, should only happen in tests.
		if newConfGetter(cfg.SectionWithEnvOverrides("database"), "").Bool(grafanaDBInstrumentQueriesKey) {
			return nil, errGrafanaDBInstrumentedNotSupported
		}
		p.engine = grafanaDB.GetEngine()
		p.logQueries = cfg.SectionWithEnvOverrides("database").Key("log_queries").MustBool(false)
		return p, nil
	default:
		return nil, fmt.Errorf("no database type specified")
	}
}

func (p *resourceDBProvider) Init(ctx context.Context) (db.DB, error) {
	p.once.Do(func() {
		p.resourceDB, p.initErr = p.initDB(ctx)
	})
	return p.resourceDB, p.initErr
}

func (p *resourceDBProvider) initDB(ctx context.Context) (db.DB, error) {
	p.log.Info("Initializing Resource DB",
		"db_type",
		p.engine.Dialect().DriverName(),
		"open_conn",
		p.engine.DB().DB.Stats().OpenConnections,
		"in_use_conn",
		p.engine.DB().DB.Stats().InUse,
		"idle_conn",
		p.engine.DB().DB.Stats().Idle,
		"max_open_conn",
		p.engine.DB().DB.Stats().MaxOpenConnections,
	)

	if p.registerMetrics {
		err := prometheus.Register(sqlstats.NewStatsCollector("unified_storage", p.engine.DB().DB))
		if err != nil {
			p.log.Warn("Failed to register unified storage sql stats collector", "error", err)
		}
	}
	_ = p.logQueries // TODO: configure SQL logging

	// TODO: change the migrator to use db.DB instead of xorm
	if p.migrateFunc != nil {
		err := p.migrateFunc(ctx, p.engine, p.cfg)
		if err != nil {
			return nil, fmt.Errorf("run migrations: %w", err)
		}
	}

	d := NewDB(p.engine.DB().DB, p.engine.Dialect().DriverName())
	d = otel.NewInstrumentedDB(d, p.tracer)

	return d, nil
}
