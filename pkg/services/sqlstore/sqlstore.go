package sqlstore

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/VividCortex/mysqlerr"
	"github.com/dlmiddlecote/sqlstats"
	"github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"xorm.io/core"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/services/stats"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// ContextSessionKey is used as key to save values in `context.Context`
type ContextSessionKey struct{}

type SQLStore struct {
	Cfg         *setting.Cfg
	features    featuremgmt.FeatureToggles
	sqlxsession *session.SessionDB

	bus                          bus.Bus
	dbCfg                        *DatabaseConfig
	engine                       *xorm.Engine
	log                          log.Logger
	Dialect                      migrator.Dialect
	skipEnsureDefaultOrgAndUser  bool
	migrations                   registry.DatabaseMigrator
	tracer                       tracing.Tracer
	recursiveQueriesAreSupported *bool
	recursiveQueriesMu           sync.Mutex
}

func ProvideService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	migrations registry.DatabaseMigrator,
	bus bus.Bus, tracer tracing.Tracer) (*SQLStore, error) {
	// This change will make xorm use an empty default schema for postgres and
	// by that mimic the functionality of how it was functioning before
	// xorm's changes above.
	xorm.DefaultPostgresSchema = ""
	s, err := newSQLStore(cfg, nil, migrations, bus, tracer)
	if err != nil {
		return nil, err
	}
	s.features = features

	if err := s.Migrate(features.IsEnabledGlobally(featuremgmt.FlagMigrationLocking)); err != nil {
		return nil, err
	}

	if err := s.Reset(); err != nil {
		return nil, err
	}
	s.tracer = tracer

	// initialize and register metrics wrapper around the *sql.DB
	db := s.engine.DB().DB

	// register the go_sql_stats_connections_* metrics
	if err := prometheus.Register(sqlstats.NewStatsCollector("grafana", db)); err != nil {
		s.log.Warn("Failed to register sqlstore stats collector", "error", err)
	}
	// TODO: deprecate/remove these metrics
	if err := prometheus.Register(newSQLStoreMetrics(db)); err != nil {
		s.log.Warn("Failed to register sqlstore metrics", "error", err)
	}

	return s, nil
}

func ProvideServiceForTests(t sqlutil.ITestDB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, migrations registry.DatabaseMigrator) (*SQLStore, error) {
	return initTestDB(t, cfg, features, migrations, InitTestDBOpt{EnsureDefaultOrgAndUser: true})
}

// NewSQLStoreWithoutSideEffects creates a new *SQLStore without side-effects such as
// running database migrations and/or ensuring main org and admin user exists.
func NewSQLStoreWithoutSideEffects(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	bus bus.Bus, tracer tracing.Tracer) (*SQLStore, error) {
	s, err := newSQLStore(cfg, nil, nil, bus, tracer)
	if err != nil {
		return nil, err
	}

	s.features = features
	s.tracer = tracer

	return s, nil
}

func newSQLStore(cfg *setting.Cfg, engine *xorm.Engine,
	migrations registry.DatabaseMigrator, bus bus.Bus, tracer tracing.Tracer, opts ...InitTestDBOpt) (*SQLStore, error) {
	ss := &SQLStore{
		Cfg:                         cfg,
		log:                         log.New("sqlstore"),
		skipEnsureDefaultOrgAndUser: false,
		migrations:                  migrations,
		bus:                         bus,
		tracer:                      tracer,
	}
	for _, opt := range opts {
		if !opt.EnsureDefaultOrgAndUser {
			ss.skipEnsureDefaultOrgAndUser = true
		}
	}

	if err := ss.initEngine(engine); err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to connect to database", err)
	}

	ss.Dialect = migrator.NewDialect(ss.engine.DriverName())

	// if err := ss.Reset(); err != nil {
	// 	return nil, err
	// }
	// // Make sure the changes are synced, so they get shared with eventual other DB connections
	// // XXX: Why is this only relevant when not skipping migrations?
	// if !ss.dbCfg.SkipMigrations {
	// 	if err := ss.Sync(); err != nil {
	// 		return nil, err
	// 	}
	// }

	return ss, nil
}

// Migrate performs database migrations.
// Has to be done in a second phase (after initialization), since other services can register migrations during
// the initialization phase.
func (ss *SQLStore) Migrate(isDatabaseLockingEnabled bool) error {
	if ss.dbCfg.SkipMigrations {
		return nil
	}

	migrator := migrator.NewMigrator(ss.engine, ss.Cfg)
	ss.migrations.AddMigration(migrator)

	return migrator.Start(isDatabaseLockingEnabled, ss.dbCfg.MigrationLockAttemptTimeout)
}

// Reset resets database state.
// If default org and user creation is enabled, it will be ensured they exist in the database.
func (ss *SQLStore) Reset() error {
	if ss.skipEnsureDefaultOrgAndUser {
		return nil
	}

	return ss.ensureMainOrgAndAdminUser(false)
}

// Quote quotes the value in the used SQL dialect
func (ss *SQLStore) Quote(value string) string {
	return ss.engine.Quote(value)
}

// GetDialect return the dialect
func (ss *SQLStore) GetDialect() migrator.Dialect {
	return ss.Dialect
}

func (ss *SQLStore) GetDBType() core.DbType {
	return ss.engine.Dialect().DBType()
}

func (ss *SQLStore) GetEngine() *xorm.Engine {
	return ss.engine
}

func (ss *SQLStore) Bus() bus.Bus {
	return ss.bus
}

func (ss *SQLStore) GetSqlxSession() *session.SessionDB {
	if ss.sqlxsession == nil {
		ss.sqlxsession = session.GetSession(sqlx.NewDb(ss.engine.DB().DB, ss.GetDialect().DriverName()))
	}
	return ss.sqlxsession
}

func (ss *SQLStore) ensureMainOrgAndAdminUser(test bool) error {
	ctx := context.Background()
	err := ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		ss.log.Debug("Ensuring main org and admin user exist")

		// If this is a test database, don't exit early when any user is found.
		if !test {
			var stats stats.SystemUserCountStats
			// TODO: Should be able to rename "Count" to "count", for more standard SQL style
			// Just have to make sure it gets deserialized properly into models.SystemUserCountStats
			rawSQL := `SELECT COUNT(id) AS Count FROM ` + ss.Dialect.Quote("user")
			if _, err := sess.SQL(rawSQL).Get(&stats); err != nil {
				return fmt.Errorf("could not determine if admin user exists: %w", err)
			}
			if stats.Count > 0 {
				return nil
			}
		}

		// ensure admin user
		if !ss.Cfg.DisableInitAdminCreation {
			ss.log.Debug("Creating default admin user")

			if _, err := ss.createUser(ctx, sess, user.CreateUserCommand{
				Login:    ss.Cfg.AdminUser,
				Email:    ss.Cfg.AdminEmail,
				Password: user.Password(ss.Cfg.AdminPassword),
				IsAdmin:  true,
			}); err != nil {
				return fmt.Errorf("failed to create admin user: %s", err)
			}

			ss.log.Info("Created default admin", "user", ss.Cfg.AdminUser)
		}

		ss.log.Debug("Creating default org", "name", mainOrgName)
		if _, err := ss.getOrCreateOrg(sess, mainOrgName); err != nil {
			return fmt.Errorf("failed to create default organization: %w", err)
		}

		ss.log.Info("Created default organization")
		return nil
	})

	return err
}

// initEngine initializes ss.engine.
func (ss *SQLStore) initEngine(engine *xorm.Engine) error {
	if ss.engine != nil {
		ss.log.Debug("Already connected to database")
		return nil
	}

	dbCfg, err := NewDatabaseConfig(ss.Cfg, ss.features)
	if err != nil {
		return err
	}

	ss.dbCfg = dbCfg

	if ss.Cfg.DatabaseInstrumentQueries {
		ss.dbCfg.Type = WrapDatabaseDriverWithHooks(ss.dbCfg.Type, ss.tracer)
	}

	ss.log.Info("Connecting to DB", "dbtype", ss.dbCfg.Type)
	if ss.dbCfg.Type == migrator.SQLite && strings.HasPrefix(ss.dbCfg.ConnectionString, "file:") &&
		!strings.HasPrefix(ss.dbCfg.ConnectionString, "file::memory:") {
		exists, err := fs.Exists(ss.dbCfg.Path)
		if err != nil {
			return fmt.Errorf("can't check for existence of %q: %w", ss.dbCfg.Path, err)
		}

		const perms = 0640
		if !exists {
			ss.log.Info("Creating SQLite database file", "path", ss.dbCfg.Path)
			f, err := os.OpenFile(ss.dbCfg.Path, os.O_CREATE|os.O_RDWR, perms)
			if err != nil {
				return fmt.Errorf("failed to create SQLite database file %q: %w", ss.dbCfg.Path, err)
			}
			if err := f.Close(); err != nil {
				return fmt.Errorf("failed to create SQLite database file %q: %w", ss.dbCfg.Path, err)
			}
		} else {
			fi, err := os.Lstat(ss.dbCfg.Path)
			if err != nil {
				return fmt.Errorf("failed to stat SQLite database file %q: %w", ss.dbCfg.Path, err)
			}
			m := fi.Mode() & os.ModePerm
			if m|perms != perms {
				ss.log.Warn("SQLite database file has broader permissions than it should",
					"path", ss.dbCfg.Path, "mode", m, "expected", os.FileMode(perms))
			}
		}
	}
	if engine == nil {
		var err error
		engine, err = xorm.NewEngine(ss.dbCfg.Type, ss.dbCfg.ConnectionString)
		if err != nil {
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
	debugSQL := ss.Cfg.Raw.Section("database").Key("log_queries").MustBool(false)
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

// The transaction_isolation system variable isn't compatible with MySQL < 5.7.20 or MariaDB. If we get an error saying this
// system variable is unknown, then replace it with it's older version tx_isolation which is compatible with MySQL < 5.7.20 and MariaDB.
func (ss *SQLStore) ensureTransactionIsolationCompatibility(engine *xorm.Engine, connectionString string) (*xorm.Engine, error) {
	var result string
	_, err := engine.SQL("SELECT 1").Get(&result)

	var mysqlError *mysql.MySQLError
	if errors.As(err, &mysqlError) {
		// if there was an error due to transaction isolation
		if strings.Contains(mysqlError.Message, "Unknown system variable 'transaction_isolation'") {
			ss.log.Debug("transaction_isolation system var is unknown, overriding in connection string with tx_isolation instead")
			// replace with compatible system var for transaction isolation
			connectionString = strings.Replace(connectionString, "&transaction_isolation", "&tx_isolation", -1)
			// recreate the xorm engine with new connection string that is compatible
			engine, err = xorm.NewEngine(ss.dbCfg.Type, connectionString)
			if err != nil {
				return nil, err
			}
		}
	} else if err != nil {
		return nil, err
	}

	return engine, nil
}

func (ss *SQLStore) GetMigrationLockAttemptTimeout() int {
	return ss.dbCfg.MigrationLockAttemptTimeout
}

func (ss *SQLStore) RecursiveQueriesAreSupported() (bool, error) {
	ss.recursiveQueriesMu.Lock()
	defer ss.recursiveQueriesMu.Unlock()
	if ss.recursiveQueriesAreSupported != nil {
		return *ss.recursiveQueriesAreSupported, nil
	}
	recursiveQueriesAreSupported := func() (bool, error) {
		var result []int
		if err := ss.WithDbSession(context.Background(), func(sess *DBSession) error {
			recQry := `WITH RECURSIVE cte (n) AS
			(
			SELECT 1
			UNION ALL
			SELECT n + 1 FROM cte WHERE n < 2
			)
			SELECT * FROM cte;
		`
			err := sess.SQL(recQry).Find(&result)
			return err
		}); err != nil {
			var driverErr *mysql.MySQLError
			if errors.As(err, &driverErr) {
				if driverErr.Number == mysqlerr.ER_PARSE_ERROR {
					return false, nil
				}
			}
			return false, err
		}
		return true, nil
	}

	areSupported, err := recursiveQueriesAreSupported()
	if err != nil {
		return false, err
	}
	ss.recursiveQueriesAreSupported = &areSupported
	return *ss.recursiveQueriesAreSupported, nil
}

var testSQLStoreSetup = false
var testSQLStore *SQLStore
var testSQLStoreMutex sync.Mutex
var testSQLStoreCleanup []func()

// InitTestDBOpt contains options for InitTestDB.
type InitTestDBOpt struct {
	// EnsureDefaultOrgAndUser flags whether to ensure that default org and user exist.
	EnsureDefaultOrgAndUser bool
	FeatureFlags            []string
}

// InitTestDBWithMigration initializes the test DB given custom migrations.
func InitTestDBWithMigration(t sqlutil.ITestDB, migration registry.DatabaseMigrator, opts ...InitTestDBOpt) *SQLStore {
	t.Helper()
	features := getFeaturesForTesting(opts...)
	store, err := initTestDB(t, setting.NewCfg(), features, migration, opts...)
	if err != nil {
		t.Fatalf("failed to initialize sql store: %s", err)
	}
	return store
}

// InitTestDB initializes the test DB.
func InitTestDB(t sqlutil.ITestDB, opts ...InitTestDBOpt) *SQLStore {
	t.Helper()
	features := getFeaturesForTesting(opts...)

	store, err := initTestDB(t, setting.NewCfg(), features, migrations.ProvideOSSMigrations(features), opts...)
	if err != nil {
		t.Fatalf("failed to initialize sql store: %s", err)
	}
	return store
}

func SetupTestDB() {
	testSQLStoreMutex.Lock()
	defer testSQLStoreMutex.Unlock()
	if testSQLStoreSetup {
		fmt.Printf("ERROR: Test DB already set up, SetupTestDB called twice\n")
		os.Exit(1)
	}
	testSQLStoreSetup = true
}

func CleanupTestDB() {
	testSQLStoreMutex.Lock()
	defer testSQLStoreMutex.Unlock()
	if !testSQLStoreSetup {
		fmt.Printf("ERROR: Test DB not set up, SetupTestDB not called\n")
		os.Exit(1)
	}
	if testSQLStore != nil {
		if err := testSQLStore.GetEngine().Close(); err != nil {
			fmt.Printf("Failed to close testSQLStore engine: %s\n", err)
		}

		for _, cleanup := range testSQLStoreCleanup {
			cleanup()
		}

		testSQLStoreCleanup = []func(){}
		testSQLStore = nil
	}
}

func getFeaturesForTesting(opts ...InitTestDBOpt) featuremgmt.FeatureToggles {
	featureKeys := []any{
		featuremgmt.FlagPanelTitleSearch,
		featuremgmt.FlagUnifiedStorage,
	}
	for _, opt := range opts {
		if len(opt.FeatureFlags) > 0 {
			for _, f := range opt.FeatureFlags {
				featureKeys = append(featureKeys, f)
			}
		}
	}
	return featuremgmt.WithFeatures(featureKeys...)
}

//nolint:gocyclo
func initTestDB(t sqlutil.ITestDB, testCfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	migration registry.DatabaseMigrator,
	opts ...InitTestDBOpt) (*SQLStore, error) {
	testSQLStoreMutex.Lock()
	defer testSQLStoreMutex.Unlock()
	if !testSQLStoreSetup {
		t.Fatalf(`

ERROR: Test DB not set up, are you missing TestMain?

https://github.com/grafana/grafana/blob/main/contribute/backend/style-guide.md

Example:

package mypkg

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

`)
		os.Exit(1)
	}

	if len(opts) == 0 {
		opts = []InitTestDBOpt{{EnsureDefaultOrgAndUser: false, FeatureFlags: []string{}}}
	}

	if testSQLStore == nil {
		dbType := sqlutil.GetTestDBType()

		// set test db config
		cfg := setting.NewCfg()
		// nolint:staticcheck
		cfg.IsFeatureToggleEnabled = features.IsEnabledGlobally

		sec, err := cfg.Raw.NewSection("database")
		if err != nil {
			return nil, err
		}

		if _, err := sec.NewKey("type", dbType); err != nil {
			return nil, err
		}

		testDB, err := sqlutil.GetTestDB(dbType)
		if err != nil {
			return nil, err
		}

		if _, err := sec.NewKey("connection_string", testDB.ConnStr); err != nil {
			return nil, err
		}
		if _, err := sec.NewKey("path", testDB.Path); err != nil {
			return nil, err
		}

		testSQLStoreCleanup = append(testSQLStoreCleanup, testDB.Cleanup)

		// useful if you already have a database that you want to use for tests.
		// cannot just set it on testSQLStore as it overrides the config in Init
		if _, present := os.LookupEnv("SKIP_MIGRATIONS"); present {
			if _, err := sec.NewKey("skip_migrations", "true"); err != nil {
				return nil, err
			}
		}

		if testCfg.Raw.HasSection("database") {
			testSec, err := testCfg.Raw.GetSection("database")
			if err == nil {
				// copy from testCfg to the Cfg keys that do not exist
				for _, k := range testSec.Keys() {
					if sec.HasKey(k.Name()) {
						continue
					}
					if _, err := sec.NewKey(k.Name(), k.Value()); err != nil {
						return nil, err
					}
				}
			}
		}

		// need to get engine to clean db before we init
		engine, err := xorm.NewEngine(dbType, sec.Key("connection_string").String())
		if err != nil {
			return nil, err
		}

		engine.DatabaseTZ = time.UTC
		engine.TZLocation = time.UTC

		tracer := tracing.InitializeTracerForTest()
		bus := bus.ProvideBus(tracer)
		testSQLStore, err = newSQLStore(cfg, engine, migration, bus, tracer, opts...)
		if err != nil {
			return nil, err
		}

		if err := testSQLStore.Migrate(false); err != nil {
			return nil, err
		}
	}

	// nolint:staticcheck
	testSQLStore.Cfg.IsFeatureToggleEnabled = features.IsEnabledGlobally

	if err := testSQLStore.Dialect.TruncateDBTables(testSQLStore.GetEngine()); err != nil {
		return nil, err
	}
	if err := testSQLStore.Reset(); err != nil {
		return nil, err
	}

	return testSQLStore, nil
}
