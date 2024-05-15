package dbimpl

import (
	"fmt"

	"github.com/dlmiddlecote/sqlstats"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	entitydb "github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/services/store/entity/db/migrations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/jmoiron/sqlx"
	"github.com/prometheus/client_golang/prometheus"
	"xorm.io/xorm"
)

var _ entitydb.EntityDBInterface = (*EntityDB)(nil)

func ProvideEntityDB(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer) (*EntityDB, error) {
	return &EntityDB{
		db:       db,
		cfg:      cfg,
		features: features,
		log:      log.New("entity-db"),
		tracer:   tracer,
	}, nil
}

type EntityDB struct {
	db       db.DB
	features featuremgmt.FeatureToggles
	engine   *xorm.Engine
	cfg      *setting.Cfg
	log      log.Logger
	tracer   tracing.Tracer
}

func (db *EntityDB) Init() error {
	_, err := db.GetEngine()
	return err
}

func (db *EntityDB) GetEngine() (*xorm.Engine, error) {
	if db.engine != nil {
		return db.engine, nil
	}

	var engine *xorm.Engine
	var err error

	cfgSection := db.cfg.SectionWithEnvOverrides("entity_api")
	dbType := cfgSection.Key("db_type").MustString("")

	// if explicit connection settings are provided, use them
	if dbType != "" {
		if dbType == "postgres" {
			engine, err = getEnginePostgres(cfgSection, db.tracer)
			if err != nil {
				return nil, err
			}

			// FIXME: this config option is cockroachdb-specific, it's not supported by postgres
			_, err = engine.Exec("SET SESSION enable_experimental_alter_column_type_general=true")
			if err != nil {
				db.log.Error("error connecting to postgres", "msg", err.Error())
				// FIXME: return nil, err
			}
		} else if dbType == "mysql" {
			engine, err = getEngineMySQL(cfgSection, db.tracer)
			if err != nil {
				return nil, err
			}
			_, err = engine.Exec("SELECT 1")
			if err != nil {
				return nil, err
			}
		} else {
			// TODO: sqlite support
			return nil, fmt.Errorf("invalid db type specified: %s", dbType)
		}

		// register sql stat metrics
		if err := prometheus.Register(sqlstats.NewStatsCollector("unified_storage", engine.DB().DB)); err != nil {
			db.log.Warn("Failed to register unified storage sql stats collector", "error", err)
		}

		// configure sql logging
		debugSQL := cfgSection.Key("log_queries").MustBool(false)
		if !debugSQL {
			engine.SetLogger(&xorm.DiscardLogger{})
		} else {
			// add stack to database calls to be able to see what repository initiated queries. Top 7 items from the stack as they are likely in the xorm library.
			// engine.SetLogger(sqlstore.NewXormLogger(log.LvlInfo, log.WithSuffix(log.New("sqlstore.xorm"), log.CallerContextKey, log.StackCaller(log.DefaultCallerDepth))))
			engine.ShowSQL(true)
			engine.ShowExecTime(true)
		}
		// otherwise, try to use the grafana db connection
	} else {
		if db.db == nil {
			return nil, fmt.Errorf("no db connection provided")
		}

		engine = db.db.GetEngine()
	}

	db.engine = engine

	if err := migrations.MigrateEntityStore(db, db.features); err != nil {
		db.engine = nil
		return nil, err
	}

	return db.engine, nil
}

func (db *EntityDB) GetSession() (*session.SessionDB, error) {
	engine, err := db.GetEngine()
	if err != nil {
		return nil, err
	}

	return session.GetSession(sqlx.NewDb(engine.DB().DB, engine.DriverName())), nil
}

func (db *EntityDB) GetCfg() *setting.Cfg {
	return db.cfg
}
