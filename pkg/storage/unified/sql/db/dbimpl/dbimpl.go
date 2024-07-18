package dbimpl

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/dlmiddlecote/sqlstats"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	resourcedb "github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/migrations"
)

var _ resourcedb.ResourceDBInterface = (*ResourceDB)(nil)

func ProvideResourceDB(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer trace.Tracer) (*ResourceDB, error) {
	return &ResourceDB{
		db:       db,
		cfg:      cfg,
		features: features,
		log:      log.New("entity-db"),
		tracer:   tracer,
	}, nil
}

type ResourceDB struct {
	once    sync.Once
	onceErr error

	db       db.DB
	features featuremgmt.FeatureToggles
	engine   *xorm.Engine
	cfg      *setting.Cfg
	log      log.Logger
	tracer   trace.Tracer

	rdb resourcedb.DB
}

func (db *ResourceDB) GetDB() (resourcedb.DB, error) {
	if db.onceErr != nil {
		return nil, db.onceErr
	}
	if db.rdb == nil {
		return nil, errors.New("database not initialized")
	}

	return db.rdb, nil
}

func (db *ResourceDB) Init(ctx context.Context) error {
	db.once.Do(func() {
		db.onceErr = db.init(ctx)
	})

	return db.onceErr
}

func (db *ResourceDB) init(ctx context.Context) error {
	if db.engine != nil {
		return nil
	}

	var engine *xorm.Engine
	var err error

	// TODO: This should be renamed resource_api
	getter := &sectionGetter{
		DynamicSection: db.cfg.SectionWithEnvOverrides("resource_api"),
	}

	dbType := getter.Key("db_type").MustString("")

	// if explicit connection settings are provided, use them
	if dbType != "" {
		if dbType == "postgres" {
			engine, err = getEnginePostgres(getter, db.tracer)
			if err != nil {
				return err
			}

			// FIXME: this config option is cockroachdb-specific, it's not supported by postgres
			// FIXME: this only sets this option for the session that we get
			// from the pool right now. A *sql.DB is a pool of connections,
			// there is no guarantee that the session where this is run will be
			// the same where we need to change the type of a column
			_, err = engine.Exec("SET SESSION enable_experimental_alter_column_type_general=true")
			if err != nil {
				db.log.Error("error connecting to postgres", "msg", err.Error())
				// FIXME: return nil, err
			}
		} else if dbType == "mysql" {
			engine, err = getEngineMySQL(getter, db.tracer)
			if err != nil {
				return err
			}

			if err = engine.Ping(); err != nil {
				return err
			}
		} else {
			// TODO: sqlite support
			return fmt.Errorf("invalid db type specified: %s", dbType)
		}

		// register sql stat metrics
		if err := prometheus.Register(sqlstats.NewStatsCollector("unified_storage", engine.DB().DB)); err != nil {
			db.log.Warn("Failed to register unified storage sql stats collector", "error", err)
		}

		// configure sql logging
		_ = getter.Key("log_queries").MustBool(false) // TODO

		// otherwise, try to use the grafana db connection
	} else {
		if db.db == nil {
			return fmt.Errorf("no db connection provided")
		}

		engine = db.db.GetEngine()
	}

	db.engine = engine

	if err := migrations.MigrateResourceStore(ctx, engine, db.cfg, db.features); err != nil {
		db.engine = nil
		return fmt.Errorf("run migrations: %w", err)
	}

	db.rdb = NewDB(engine.DB().DB, engine.Dialect().DriverName())

	return nil
}
