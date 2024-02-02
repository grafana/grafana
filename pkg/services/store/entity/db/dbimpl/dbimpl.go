package dbimpl

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	entitydb "github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/services/store/entity/db/migrations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/jmoiron/sqlx"
	"xorm.io/xorm"
)

var _ entitydb.EntityDBInterface = (*EntityDB)(nil)

func ProvideEntityDB(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles) (*EntityDB, error) {
	return &EntityDB{
		db:       db,
		cfg:      cfg,
		features: features,
		log:      log.New("entity-db"),
	}, nil
}

type EntityDB struct {
	db       db.DB
	features featuremgmt.FeatureToggles
	engine   *xorm.Engine
	cfg      *setting.Cfg
	log      log.Logger
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
		dbHost := cfgSection.Key("db_host").MustString("")
		dbName := cfgSection.Key("db_name").MustString("")
		dbUser := cfgSection.Key("db_user").MustString("")
		dbPass := cfgSection.Key("db_pass").MustString("")

		if dbType == "postgres" {
			// TODO: support all postgres connection options
			dbSslMode := cfgSection.Key("db_sslmode").MustString("disable")

			addr, err := util.SplitHostPortDefault(dbHost, "127.0.0.1", "5432")
			if err != nil {
				return nil, fmt.Errorf("invalid host specifier '%s': %w", dbHost, err)
			}

			connectionString := fmt.Sprintf(
				"user=%s password=%s host=%s port=%s dbname=%s sslmode=%s", // sslcert=%s sslkey=%s sslrootcert=%s",
				dbUser, dbPass, addr.Host, addr.Port, dbName, dbSslMode, // ss.dbCfg.ClientCertPath, ss.dbCfg.ClientKeyPath, ss.dbCfg.CaCertPath
			)

			engine, err = xorm.NewEngine("postgres", connectionString)
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
			// TODO: support all mysql connection options
			protocol := "tcp"
			if strings.HasPrefix(dbHost, "/") {
				protocol = "unix"
			}

			connectionString := fmt.Sprintf("%s:%s@%s(%s)/%s?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true",
				dbUser, dbPass, protocol, dbHost, dbName)

			engine, err = xorm.NewEngine("mysql", connectionString)
			if err != nil {
				return nil, err
			}

			engine.SetMaxOpenConns(0)
			engine.SetMaxIdleConns(2)
			engine.SetConnMaxLifetime(time.Second * time.Duration(14400))

			_, err = engine.Exec("SELECT 1")
			if err != nil {
				return nil, err
			}
		} else {
			// TODO: sqlite support
			return nil, fmt.Errorf("invalid db type specified: %s", dbType)
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
