package dbimpl

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/dlmiddlecote/sqlstats"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/sqlutil"
	storagemigrator "github.com/grafana/grafana/pkg/storage/sqlutil/migrator"
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

type resourceDBProvider struct {
	handle          storagemigrator.Handle
	dataSourceName  string
	cfg             *setting.Cfg
	log             log.Logger
	migrateFunc     func(context.Context, storagemigrator.Handle, *setting.Cfg) error
	tracer          trace.Tracer
	registerMetrics bool
	logQueries      bool

	once       sync.Once
	resourceDB db.DB
	initErr    error
}

func ProvideResourceDB(grafanaDB sqlutil.SessionProvider, cfg *setting.Cfg, tracer trace.Tracer) (db.DBProvider, error) {
	if tracer == nil {
		tracer = noop.NewTracerProvider().Tracer("test-tracer")
	}
	p, err := newResourceDBProvider(grafanaDB, cfg, tracer)
	if err != nil {
		return nil, fmt.Errorf("provide Resource DB: %w", err)
	}
	return p, nil
}

func newResourceDBProvider(grafanaDB sqlutil.SessionProvider, cfg *setting.Cfg, tracer trace.Tracer) (*resourceDBProvider, error) {
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
		dbCfg, err := NewDatabaseConfig(cfg)
		if err != nil {
			return nil, err
		}
		p.registerMetrics = true
		p.handle, err = getSession(dbCfg)
		p.dataSourceName = dbCfg.ConnectionString
		return p, err
	case grafanaDB != nil:
		// Try to use the grafana db connection, should only happen in tests.
		if newConfGetter(cfg.SectionWithEnvOverrides("database"), "").Bool(grafanaDBInstrumentQueriesKey) {
			return nil, errGrafanaDBInstrumentedNotSupported
		}
		p.handle = grafanaDB.GetSqlxSession()
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
	stats := p.handle.SqlDB().Stats()
	p.log.Info("Initializing Resource DB",
		"db_type",
		p.handle.DriverName(),
		"open_conn",
		stats.OpenConnections,
		"in_use_conn",
		stats.InUse,
		"idle_conn",
		stats.Idle,
		"max_open_conn",
		stats.MaxOpenConnections,
	)

	if p.registerMetrics {
		if err := prometheus.Register(collectors.NewDBStatsCollector(p.handle.SqlDB(), "unified_storage")); err != nil {
			p.log.Warn("Failed to register 'Prometheus collector' unified storage sql stats collector", "error", err)
		}

		// TODO(@macabu/2026-03-04): Remove on G14 as these metrics are the same as the ones above.
		if p.cfg.DatabaseRegisterDeprecatedMetrics {
			err := prometheus.Register(sqlstats.NewStatsCollector("unified_storage", p.handle.SqlDB()))
			if err != nil {
				p.log.Warn("Failed to register 'sqlstats' unified storage sql stats collector", "error", err)
			}
		}
	}
	_ = p.logQueries // TODO: configure SQL logging

	if p.migrateFunc != nil {
		err := p.migrateFunc(ctx, p.handle, p.cfg)
		if err != nil {
			return nil, fmt.Errorf("run migrations: %w", err)
		}
	}

	d := NewDB(p.handle.SqlDB(), p.handle.DriverName())
	d = otel.NewInstrumentedDB(d, p.tracer)

	return d, nil
}
