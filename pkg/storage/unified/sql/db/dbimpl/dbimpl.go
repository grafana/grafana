package dbimpl

import (
	"context"
	"fmt"
	"sync"

	"github.com/dlmiddlecote/sqlstats"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"xorm.io/xorm"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/migrations"
)

const (
	dbTypeMySQL    = "mysql"
	dbTypePostgres = "postgres"
)

func ProvideResourceDB(grafanaDB infraDB.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer trace.Tracer) (db.DBProvider, error) {
	p, err := newResourceDBProvider(grafanaDB, cfg, features, tracer)
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
	registerMetrics bool
	logQueries      bool
}

func newResourceDBProvider(grafanaDB infraDB.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer trace.Tracer) (p *resourceDBProvider, err error) {
	// TODO: This should be renamed resource_api
	getter := &sectionGetter{
		DynamicSection: cfg.SectionWithEnvOverrides("resource_api"),
	}

	p = &resourceDBProvider{
		cfg:        cfg,
		log:        log.New("entity-db"),
		logQueries: getter.Key("log_queries").MustBool(false),
	}
	if features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorage) {
		p.migrateFunc = migrations.MigrateResourceStore
	}

	switch dbType := getter.Key("db_type").MustString(""); dbType {
	case dbTypePostgres:
		p.registerMetrics = true
		p.engine, err = getEnginePostgres(getter, tracer)
		return p, err

	case dbTypeMySQL:
		p.registerMetrics = true
		p.engine, err = getEngineMySQL(getter, tracer)
		return p, err

	case "":
		// try to use the grafana db connection
		if grafanaDB == nil {
			return p, fmt.Errorf("no db connection provided")
		}
		p.engine = grafanaDB.GetEngine()
		return p, nil

	default:
		// TODO: sqlite support
		return p, fmt.Errorf("invalid db type specified: %s", dbType)
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
	// Skip migrations if feature flag is not enabled
	if p.migrateFunc != nil {
		err := p.migrateFunc(ctx, p.engine, p.cfg)
		if err != nil {
			return nil, fmt.Errorf("run migrations: %w", err)
		}
	}

	return NewDB(p.engine.DB().DB, p.engine.Dialect().DriverName()), nil
}
