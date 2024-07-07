package dbimpl

import (
	"fmt"
	"sync"

	"github.com/dlmiddlecote/sqlstats"
	"github.com/jmoiron/sqlx"
	"github.com/prometheus/client_golang/prometheus"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/setting"
	resourcedb "github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/migrations"
)

var _ resourcedb.ResourceDBInterface = (*ResourceDB)(nil)

func ProvideResourceDB(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer) (*ResourceDB, error) {
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
	tracer   tracing.Tracer
}

func (db *ResourceDB) Init() error {
	db.once.Do(func() {
		db.onceErr = db.init()
	})

	return db.onceErr
}

func (db *ResourceDB) GetEngine() (*xorm.Engine, error) {
	if err := db.Init(); err != nil {
		return nil, err
	}

	return db.engine, db.onceErr
}

func (db *ResourceDB) init() error {
	if db.engine != nil {
		return nil
	}

	var engine *xorm.Engine
	var err error

	// TODO: This should be renamed resource_api
	getter := &sectionGetter{
		DynamicSection: db.cfg.SectionWithEnvOverrides("entity_api"),
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
		debugSQL := getter.Key("log_queries").MustBool(false)
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
			return fmt.Errorf("no db connection provided")
		}

		engine = db.db.GetEngine()
	}

	db.engine = engine

	if err := migrations.MigrateResourceStore(engine, db.cfg, db.features); err != nil {
		db.engine = nil
		return fmt.Errorf("run migrations: %w", err)
	}

	return nil
}

func (db *ResourceDB) GetSession() (*session.SessionDB, error) {
	engine, err := db.GetEngine()
	if err != nil {
		return nil, err
	}

	return session.GetSession(sqlx.NewDb(engine.DB().DB, engine.DriverName())), nil
}

func (db *ResourceDB) GetCfg() *setting.Cfg {
	return db.cfg
}

func (db *ResourceDB) GetDB() (resourcedb.DB, error) {
	engine, err := db.GetEngine()
	if err != nil {
		return nil, err
	}

	ret := NewDB(engine.DB().DB, engine.Dialect().DriverName())

	return ret, nil
}
