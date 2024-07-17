package sqlstore

import (
	"errors"
	"sync/atomic"
	"time"

	"github.com/dlmiddlecote/sqlstats"
	"github.com/prometheus/client_golang/prometheus"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
)

// ReplStore is a wrapper around a main SQLStore and a read-only SQLStore. The
// main SQLStore is anonymous, so the ReplStore may be used directly as a
// SQLStore.
type ReplStore struct {
	*SQLStore
	repls []*SQLStore

	// next is the index of the next read-only SQLStore in the chain.
	next uint64
}

// DB returns the main SQLStore.
func (rs *ReplStore) DB() *SQLStore {
	return rs.SQLStore
}

// ReadReplica returns the read-only SQLStore. If no read replica is configured,
// it returns the main SQLStore.
func (rs *ReplStore) ReadReplica() *SQLStore {
	if rs.repls == nil || len(rs.repls) == 0 {
		rs.log.Debug("ReadReplica not configured, using main SQLStore")
		return rs.SQLStore
	}
	rs.log.Debug("Using ReadReplica")
	return rs.nextRepl()
}

// nextRepl() returns the next read-only SQLStore in the chain. If no read replica is configured, the Primary is returned.
func (rs *ReplStore) nextRepl() *SQLStore {
	// start by grabbing the replica at the current index
	selected := rs.repls[(int(rs.next))%len(rs.repls)]

	// then increment the index for the next call
	atomic.AddUint64(&rs.next, 1)

	return selected
}

// ProvideServiceWithReadReplica creates a new *SQLStore connection intended for
// use as a ReadReplica of the main SQLStore. The primary SQLStore must already
// be initialized.
func ProvideServiceWithReadReplica(primary *SQLStore, cfg *setting.Cfg,
	features featuremgmt.FeatureToggles, migrations registry.DatabaseMigrator,
	bus bus.Bus, tracer tracing.Tracer) (*ReplStore, error) {
	// start with the initialized SQLStore
	replStore := &ReplStore{primary, nil, 0}

	// FeatureToggle fallback: If the FlagDatabaseReadReplica feature flag is not enabled, return a single SQLStore.
	if !features.IsEnabledGlobally(featuremgmt.FlagDatabaseReadReplica) {
		primary.log.Debug("ReadReplica feature flag not enabled, using main SQLStore")
		return replStore, nil
	}

	// This change will make xorm use an empty default schema for postgres and
	// by that mimic the functionality of how it was functioning before
	// xorm's changes above.
	xorm.DefaultPostgresSchema = ""

	// Parsing the configuration to get the number of repls
	replCfgs, err := NewRODatabaseConfigs(cfg, features)
	if err != nil {
		return nil, err
	}

	if len(replCfgs) > 0 {
		replStore.repls = make([]*SQLStore, len(replCfgs))
	}

	for i, replCfg := range replCfgs {
		s, err := newReadOnlySQLStore(cfg, replCfg, features, bus, tracer)
		if err != nil {
			return nil, err
		}

		// initialize and register metrics wrapper around the *sql.DB
		db := s.engine.DB().DB

		// register the go_sql_stats_connections_* metrics
		if err := prometheus.Register(sqlstats.NewStatsCollector("grafana_repl", db)); err != nil {
			s.log.Warn("Failed to register sqlstore stats collector", "error", err)
		}
		replStore.repls[i] = s
	}
	return replStore, nil
}

// newReadOnlySQLStore creates a new *SQLStore intended for use with a
// fully-populated read replica of the main Grafana Database. It provides no
// write capabilities and does not run migrations, but other tracing and logging
// features are enabled.
func newReadOnlySQLStore(cfg *setting.Cfg, dbCfg *DatabaseConfig, features featuremgmt.FeatureToggles, bus bus.Bus, tracer tracing.Tracer) (*SQLStore, error) {
	s := &SQLStore{
		log:      log.New("replstore"),
		bus:      bus,
		tracer:   tracer,
		features: features,
		dbCfg:    dbCfg,
		cfg:      cfg,
	}

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
		ss.log.Debug("Already connected to database replica")
		return nil
	}

	if ss.cfg.DatabaseInstrumentQueries {
		ss.dbCfg.Type = WrapDatabaseReplDriverWithHooks(ss.dbCfg.Type, ss.tracer)
	}

	if engine == nil {
		var err error
		engine, err = xorm.NewEngine(ss.dbCfg.Type, ss.dbCfg.ConnectionString)
		if err != nil {
			ss.log.Error("failed to connect to database replica", "error", err)
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
	debugSQL := ss.cfg.Raw.Section("database_replica").Key("log_queries").MustBool(false)
	if !debugSQL {
		engine.SetLogger(&xorm.DiscardLogger{})
	} else {
		// add stack to database calls to be able to see what repository initiated queries. Top 7 items from the stack as they are likely in the xorm library.
		engine.SetLogger(NewXormLogger(log.LvlInfo, log.WithSuffix(log.New("replsstore.xorm"), log.CallerContextKey, log.StackCaller(log.DefaultCallerDepth))))
		engine.ShowSQL(true)
		engine.ShowExecTime(true)
	}

	ss.engine = engine
	return nil
}

// NewRODatabaseConfig creates a new read-only database configuration.
func NewRODatabaseConfigs(cfg *setting.Cfg, features featuremgmt.FeatureToggles) ([]*DatabaseConfig, error) {
	if cfg == nil {
		return nil, errors.New("cfg cannot be nil")
	}

	// if only one replica is configured in the database_replicas section, use it as the default
	defaultReplCfg := &DatabaseConfig{}
	if err := defaultReplCfg.readConfigSection(cfg, "database_replicas"); err != nil {
		return nil, err
	}
	err := defaultReplCfg.buildConnectionString(cfg, features)
	if err != nil {
		return nil, err
	}
	ret := []*DatabaseConfig{defaultReplCfg}

	// Check for additional replicas as children of the database_replicas section (e.g. database_replicas.one, database_replicas.cheetara)
	repls := cfg.Raw.Section("database_replicas")
	if len(repls.ChildSections()) > 0 {
		for _, sec := range repls.ChildSections() {
			replCfg := &DatabaseConfig{}
			if err := replCfg.parseConfigIni(sec); err != nil {
				return nil, err
			}
			if err := replCfg.buildConnectionString(cfg, features); err != nil {
				return nil, err
			}
			ret = append(ret, replCfg)
		}
	}

	return ret, nil
}

// ProvideServiceWithReadReplicaForTests wraps the SQLStore in a ReplStore, with the main sqlstore as both the primary and read replica.
// TODO: eventually this should be replaced with a more robust test setup which in
func ProvideServiceWithReadReplicaForTests(testDB *SQLStore, t sqlutil.ITestDB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, migrations registry.DatabaseMigrator) (*ReplStore, error) {
	return newReplStore(testDB, testDB), nil
}

// InitTestReplDB initializes a test DB and returns it wrapped in a ReplStore with the main SQLStore as both the primary and read replica.
func InitTestReplDB(t sqlutil.ITestDB, opts ...InitTestDBOpt) (*ReplStore, *setting.Cfg) {
	t.Helper()
	features := getFeaturesForTesting(opts...)
	cfg := getCfgForTesting(opts...)
	ss, err := initTestDB(t, cfg, features, migrations.ProvideOSSMigrations(features), opts...)
	if err != nil {
		t.Fatalf("failed to initialize sql repl store: %s", err)
	}
	return newReplStore(ss, ss), cfg
}

// InitTestReplDBWithMigration initializes the test DB given custom migrations.
func InitTestReplDBWithMigration(t sqlutil.ITestDB, migration registry.DatabaseMigrator, opts ...InitTestDBOpt) *ReplStore {
	t.Helper()
	features := getFeaturesForTesting(opts...)
	cfg := getCfgForTesting(opts...)
	ss, err := initTestDB(t, cfg, features, migration, opts...)
	if err != nil {
		t.Fatalf("failed to initialize sql store: %s", err)
	}
	return newReplStore(ss, ss)
}

// newReplStore is a wrapper function that returns a ReplStore with the given primary and read replicas.
func newReplStore(primary *SQLStore, readReplicas ...*SQLStore) *ReplStore {
	ret := &ReplStore{
		SQLStore: primary,
		repls:    make([]*SQLStore, len(readReplicas)),
		next:     0,
	}
	ret.repls = readReplicas
	return ret
}
