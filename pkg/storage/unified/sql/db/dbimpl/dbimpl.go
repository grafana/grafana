package dbimpl

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/dlmiddlecote/sqlstats"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

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
	" in the [resource_api] section. But we detected that the key `" +
	grafanaDBInstrumentQueriesKey + "` is enabled in [database], and that" +
	" setup is currently unsupported. Please, consider disabling that flag")

func ProvideResourceDB(grafanaDB infraDB.DB, cfg *setting.Cfg, tracer trace.Tracer) (db.DBProvider, error) {
	if tracer == nil {
		tracer = noop.NewTracerProvider().Tracer("test-tracer")
	}
	p, err := newResourceDBProvider(grafanaDB, cfg, tracer)
	if err != nil {
		return nil, fmt.Errorf("provide Resource DB: %w", err)
	}
	var once sync.Once
	var resourceDB db.DB

	return dbProviderFunc(func(ctx context.Context) (db.DB, error) {
		once.Do(func() {
			resourceDB, err = p.init(ctx)
		})
		return resourceDB, err
	}), nil
}

type dbProviderFunc func(context.Context) (db.DB, error)

func (f dbProviderFunc) Init(ctx context.Context) (db.DB, error) {
	return f(ctx)
}

type resourceDBProvider struct {
	engine          *xorm.Engine
	cfg             *setting.Cfg
	log             log.Logger
	migrateFunc     func(context.Context, *xorm.Engine, *setting.Cfg) error
	tracer          trace.Tracer
	registerMetrics bool
	logQueries      bool
}

func newResourceDBProvider(grafanaDB infraDB.DB, cfg *setting.Cfg, tracer trace.Tracer) (p *resourceDBProvider, err error) {
	// Resource API has other configs in its section besides database ones, so
	// we prefix them with "db_". We use the database config from core Grafana
	// as fallback, and as it uses a dedicated INI section, then keys are not
	// prefixed with "db_"
	getter := newConfGetter(cfg.SectionWithEnvOverrides("resource_api"), "db_")
	fallbackGetter := newConfGetter(cfg.SectionWithEnvOverrides("database"), "")

	p = &resourceDBProvider{
		cfg:         cfg,
		log:         log.New("entity-db"),
		logQueries:  getter.Bool("log_queries"),
		migrateFunc: migrations.MigrateResourceStore,
		tracer:      tracer,
	}

	dbType := getter.String("type")
	grafanaDBType := fallbackGetter.String("type")
	switch {
	// Deprecated: First try with the config in the "resource_api" section, which is specific to Unified Storage
	case dbType == dbTypePostgres:
		p.registerMetrics = true
		p.engine, err = getEnginePostgres(getter)
		return p, err

	case dbType == dbTypeMySQL:
		p.registerMetrics = true
		p.engine, err = getEngineMySQL(getter)
		return p, err

	case dbType != "":
		return p, fmt.Errorf("invalid db type specified: %s", dbType)

	// If we have an empty Resource API db config, try with the core Grafana database config
	case grafanaDBType != "":
		p.registerMetrics = true
		p.engine, err = getEngine(cfg)
		return p, err
	case grafanaDB != nil:
		// try to use the grafana db connection (should only happen in tests)
		if fallbackGetter.Bool(grafanaDBInstrumentQueriesKey) {
			return nil, errGrafanaDBInstrumentedNotSupported
		}
		p.engine = grafanaDB.GetEngine()
		return p, nil
	default:
		return p, fmt.Errorf("no database type specified")
	}
}

func (p *resourceDBProvider) init(ctx context.Context) (db.DB, error) {
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
