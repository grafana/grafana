package sqlstore

import (
	"errors"
	"time"

	"github.com/dlmiddlecote/sqlstats"
	"github.com/prometheus/client_golang/prometheus"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

// provideReadOnlyService creates a new *SQLStore intended for use as a ReadReplica of the main SQLStore.
func provideReadOnlyService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	bus bus.Bus, tracer tracing.Tracer) (*SQLStore, error) {
	// This change will make xorm use an empty default schema for postgres and
	// by that mimic the functionality of how it was functioning before
	// xorm's changes above.
	xorm.DefaultPostgresSchema = ""
	s, err := newReadOnlySQLStore(cfg, features, bus, tracer)
	if err != nil {
		return nil, err
	}
	s.features = features
	s.tracer = tracer

	// initialize and register metrics wrapper around the *sql.DB
	db := s.engine.DB().DB

	// register the go_sql_stats_connections_* metrics
	if err := prometheus.Register(sqlstats.NewStatsCollector("grafana", db)); err != nil {
		s.log.Warn("Failed to register sqlstore stats collector", "error", err)
	}
	return s, nil
}

// newReadOnlySQLStore creates a new *SQLStore intended for use with a
// fully-populated read replica of the main Grafana Database. It provides no
// write capabilities and does not run migrations, but other tracing and logging
// features are enabled.
func newReadOnlySQLStore(cfg *setting.Cfg, features featuremgmt.FeatureToggles, bus bus.Bus, tracer tracing.Tracer) (*SQLStore, error) {
	s := &SQLStore{
		cfg:    cfg,
		log:    log.New("sqlstore"),
		bus:    bus,
		tracer: tracer,
	}

	s.features = features
	s.tracer = tracer

	err := s.initReadOnlyEngine(s.engine)
	if err != nil {
		return nil, err
	}
	s.dialect = migrator.NewDialect(s.engine.DriverName())
	return s, nil
}

// initReadOnlyEngine initializes ss.engine for read-only operations. The database must be a fully-populated read replica.
func (ss *SQLStore) initReadOnlyEngine(engine *xorm.Engine) error {
	if ss.engine != nil {
		ss.log.Debug("Already connected to database")
		return nil
	}

	dbCfg, err := NewRODatabaseConfig(ss.cfg, ss.features)
	if err != nil {
		return err
	}
	ss.dbCfg = dbCfg

	if ss.cfg.DatabaseInstrumentQueries {
		ss.dbCfg.Type = WrapDatabaseDriverWithHooks(ss.dbCfg.Type, ss.tracer)
	}

	if engine == nil {
		var err error
		engine, err = xorm.NewEngine(ss.dbCfg.Type, ss.dbCfg.ConnectionString)
		if err != nil {
			ss.log.Error("failed to connect to database", "error", err)
			return err
		}
		// Only for MySQL or MariaDB, verify we can connect with the current connection string's system var for transaction isolation.
		// If not, create a new engine with a compatible connection string.
		if ss.dbCfg.Type == migrator.MySQL {
			engine, err = ss.ensureTransactionIsolationCompatibility(engine, ss.dbCfg.ConnectionString)
			if err != nil {
				return err
			}
		}
	}

	engine.SetMaxOpenConns(ss.dbCfg.MaxOpenConn)
	engine.SetMaxIdleConns(ss.dbCfg.MaxIdleConn)
	engine.SetConnMaxLifetime(time.Second * time.Duration(ss.dbCfg.ConnMaxLifetime))

	// configure sql logging
	debugSQL := ss.cfg.Raw.Section("database").Key("log_queries").MustBool(false)
	if !debugSQL {
		engine.SetLogger(&xorm.DiscardLogger{})
	} else {
		// add stack to database calls to be able to see what repository initiated queries. Top 7 items from the stack as they are likely in the xorm library.
		engine.SetLogger(NewXormLogger(log.LvlInfo, log.WithSuffix(log.New("sqlstore.xorm"), log.CallerContextKey, log.StackCaller(log.DefaultCallerDepth))))
		engine.ShowSQL(true)
		engine.ShowExecTime(true)
	}

	ss.engine = engine
	return nil
}

// NewRODatabaseConfig creates a new read-only database configuration.
func NewRODatabaseConfig(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (*DatabaseConfig, error) {
	if cfg == nil {
		return nil, errors.New("cfg cannot be nil")
	}

	dbCfg := &DatabaseConfig{}
	if err := dbCfg.readConfigSection(cfg, "database_replica"); err != nil {
		return nil, err
	}

	if err := dbCfg.buildConnectionString(cfg, features); err != nil {
		return nil, err
	}

	return dbCfg, nil
}
