package sqlstore

import (
	"context"
	"errors"
	"fmt"
	"net/url"
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
	"github.com/grafana/grafana/pkg/infra/db/dbconn"
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
	sqlxsession *session.SessionDB

	bus                          bus.Bus
	dbCfg                        DatabaseConfig
	engine                       *xorm.Engine
	log                          log.Logger
	Dialect                      migrator.Dialect
	skipEnsureDefaultOrgAndUser  bool
	migrations                   registry.DatabaseMigrator
	tracer                       tracing.Tracer
	recursiveQueriesAreSupported *bool
	recursiveQueriesMu           sync.Mutex
}

func ProvideService(cfg *setting.Cfg, migrations registry.DatabaseMigrator, bus bus.Bus, tracer tracing.Tracer) (*SQLStore, error) {
	s, err := newSQLStore(cfg, nil, migrations, bus, tracer)
	if err != nil {
		return nil, err
	}

	// nolint:staticcheck
	if err := s.Migrate(cfg.IsFeatureToggleEnabled(featuremgmt.FlagMigrationLocking)); err != nil {
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

func ProvideServiceForTests(cfg *setting.Cfg, migrations registry.DatabaseMigrator) (*SQLStore, error) {
	return initTestDB(cfg, migrations, InitTestDBOpt{EnsureDefaultOrgAndUser: true})
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

	conn, err := dbconn.New(cfg, engine, tracer)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to connect to database", err)
	}
	ss.engine = conn.Engine()

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

// Sync syncs changes to the database.
func (ss *SQLStore) Sync() error {
	return ss.engine.Sync2()
}

// Reset resets database state.
// If default org and user creation is enabled, it will be ensured they exist in the database.
func (ss *SQLStore) Reset() error {
	if ss.skipEnsureDefaultOrgAndUser {
		return nil
	}

	return ss.ensureMainOrgAndAdminUser(false)
}

// TestReset resets database state. If default org and user creation is enabled,
// it will be ensured they exist in the database. TestReset() is more permissive
// than Reset in that it will create the user and org whether or not there are
// already users in the database.
func (ss *SQLStore) TestReset() error {
	if ss.skipEnsureDefaultOrgAndUser {
		return nil
	}

	return ss.ensureMainOrgAndAdminUser(true)
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
				Password: ss.Cfg.AdminPassword,
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

// readConfig initializes the SQLStore from its configuration.
func (ss *SQLStore) readConfig() error {
	sec := ss.Cfg.Raw.Section("database")

	cfgURL := sec.Key("url").String()
	if len(cfgURL) != 0 {
		dbURL, err := url.Parse(cfgURL)
		if err != nil {
			return err
		}
		ss.dbCfg.Type = dbURL.Scheme
		ss.dbCfg.Host = dbURL.Host

		pathSplit := strings.Split(dbURL.Path, "/")
		if len(pathSplit) > 1 {
			ss.dbCfg.Name = pathSplit[1]
		}

		userInfo := dbURL.User
		if userInfo != nil {
			ss.dbCfg.User = userInfo.Username()
			ss.dbCfg.Pwd, _ = userInfo.Password()
		}

		ss.dbCfg.UrlQueryParams = dbURL.Query()
	} else {
		ss.dbCfg.Type = sec.Key("type").String()
		ss.dbCfg.Host = sec.Key("host").String()
		ss.dbCfg.Name = sec.Key("name").String()
		ss.dbCfg.User = sec.Key("user").String()
		ss.dbCfg.ConnectionString = sec.Key("connection_string").String()
		ss.dbCfg.Pwd = sec.Key("password").String()
	}

	ss.dbCfg.MaxOpenConn = sec.Key("max_open_conn").MustInt(0)
	ss.dbCfg.MaxIdleConn = sec.Key("max_idle_conn").MustInt(2)
	ss.dbCfg.ConnMaxLifetime = sec.Key("conn_max_lifetime").MustInt(14400)

	ss.dbCfg.SslMode = sec.Key("ssl_mode").String()
	ss.dbCfg.CaCertPath = sec.Key("ca_cert_path").String()
	ss.dbCfg.ClientKeyPath = sec.Key("client_key_path").String()
	ss.dbCfg.ClientCertPath = sec.Key("client_cert_path").String()
	ss.dbCfg.ServerCertName = sec.Key("server_cert_name").String()
	ss.dbCfg.Path = sec.Key("path").MustString("data/grafana.db")
	ss.dbCfg.IsolationLevel = sec.Key("isolation_level").String()

	ss.dbCfg.CacheMode = sec.Key("cache_mode").MustString("private")
	ss.dbCfg.WALEnabled = sec.Key("wal").MustBool(false)
	ss.dbCfg.SkipMigrations = sec.Key("skip_migrations").MustBool()
	ss.dbCfg.MigrationLockAttemptTimeout = sec.Key("locking_attempt_timeout_sec").MustInt()

	ss.dbCfg.QueryRetries = sec.Key("query_retries").MustInt()
	ss.dbCfg.TransactionRetries = sec.Key("transaction_retries").MustInt(5)
	return nil
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

// ITestDB is an interface of arguments for testing db
type ITestDB interface {
	Helper()
	Fatalf(format string, args ...any)
	Logf(format string, args ...any)
	Log(args ...any)
}

var testSQLStore *SQLStore
var testSQLStoreMutex sync.Mutex

// InitTestDBOpt contains options for InitTestDB.
type InitTestDBOpt struct {
	// EnsureDefaultOrgAndUser flags whether to ensure that default org and user exist.
	EnsureDefaultOrgAndUser bool
	FeatureFlags            []string
}

var featuresEnabledDuringTests = []string{
	featuremgmt.FlagPanelTitleSearch,
	featuremgmt.FlagUnifiedStorage,
}

// InitTestDBWithMigration initializes the test DB given custom migrations.
func InitTestDBWithMigration(t ITestDB, migration registry.DatabaseMigrator, opts ...InitTestDBOpt) *SQLStore {
	t.Helper()
	store, err := initTestDB(setting.NewCfg(), migration, opts...)
	if err != nil {
		t.Fatalf("failed to initialize sql store: %s", err)
	}
	return store
}

// InitTestDB initializes the test DB.
func InitTestDB(t ITestDB, opts ...InitTestDBOpt) *SQLStore {
	t.Helper()
	store, err := initTestDB(setting.NewCfg(), &migrations.OSSMigrations{}, opts...)
	if err != nil {
		t.Fatalf("failed to initialize sql store: %s", err)
	}
	return store
}

func InitTestDBWithCfg(t ITestDB, opts ...InitTestDBOpt) (*SQLStore, *setting.Cfg) {
	store := InitTestDB(t, opts...)
	return store, store.Cfg
}

//nolint:gocyclo
func initTestDB(testCfg *setting.Cfg, migration registry.DatabaseMigrator, opts ...InitTestDBOpt) (*SQLStore, error) {
	testSQLStoreMutex.Lock()
	defer testSQLStoreMutex.Unlock()

	if len(opts) == 0 {
		opts = []InitTestDBOpt{{EnsureDefaultOrgAndUser: false, FeatureFlags: []string{}}}
	}

	features := make([]string, len(featuresEnabledDuringTests))
	copy(features, featuresEnabledDuringTests)
	for _, opt := range opts {
		if len(opt.FeatureFlags) > 0 {
			features = append(features, opt.FeatureFlags...)
		}
	}

	if testSQLStore == nil {
		dbType := migrator.SQLite

		// environment variable present for test db?
		if db, present := os.LookupEnv("GRAFANA_TEST_DB"); present {
			dbType = db
		}

		// set test db config
		cfg := setting.NewCfg()
		// nolint:staticcheck
		cfg.IsFeatureToggleEnabled = func(key string) bool {
			for _, enabledFeature := range features {
				if enabledFeature == key {
					return true
				}
			}
			return false
		}

		sec, err := cfg.Raw.NewSection("database")
		if err != nil {
			return nil, err
		}

		if _, err := sec.NewKey("type", dbType); err != nil {
			return nil, err
		}
		switch dbType {
		case "mysql":
			if _, err := sec.NewKey("connection_string", sqlutil.MySQLTestDB().ConnStr); err != nil {
				return nil, err
			}
		case "postgres":
			if _, err := sec.NewKey("connection_string", sqlutil.PostgresTestDB().ConnStr); err != nil {
				return nil, err
			}
		default:
			if _, err := sec.NewKey("connection_string", sqlutil.SQLite3TestDB().ConnStr); err != nil {
				return nil, err
			}
		}

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

		if err := testSQLStore.Dialect.TruncateDBTables(engine); err != nil {
			return nil, err
		}

		if err := testSQLStore.Reset(); err != nil {
			return nil, err
		}

		// Make sure the changes are synced, so they get shared with eventual other DB connections
		// XXX: Why is this only relevant when not skipping migrations?
		if !testSQLStore.dbCfg.SkipMigrations {
			if err := testSQLStore.Sync(); err != nil {
				return nil, err
			}
		}

		return testSQLStore, nil
	}

	// nolint:staticcheck
	testSQLStore.Cfg.IsFeatureToggleEnabled = func(key string) bool {
		for _, enabledFeature := range features {
			if enabledFeature == key {
				return true
			}
		}
		return false
	}

	if err := testSQLStore.Dialect.TruncateDBTables(testSQLStore.GetEngine()); err != nil {
		return nil, err
	}
	if err := testSQLStore.Reset(); err != nil {
		return nil, err
	}

	return testSQLStore, nil
}

func IsTestDbMySQL() bool {
	if db, present := os.LookupEnv("GRAFANA_TEST_DB"); present {
		return db == migrator.MySQL
	}

	return false
}

func IsTestDbPostgres() bool {
	if db, present := os.LookupEnv("GRAFANA_TEST_DB"); present {
		return db == migrator.Postgres
	}

	return false
}

func IsTestDBMSSQL() bool {
	if db, present := os.LookupEnv("GRAFANA_TEST_DB"); present {
		return db == migrator.MSSQL
	}

	return false
}

type DatabaseConfig struct {
	Type                        string
	Host                        string
	Name                        string
	User                        string
	Pwd                         string
	Path                        string
	SslMode                     string
	CaCertPath                  string
	ClientKeyPath               string
	ClientCertPath              string
	ServerCertName              string
	ConnectionString            string
	IsolationLevel              string
	MaxOpenConn                 int
	MaxIdleConn                 int
	ConnMaxLifetime             int
	CacheMode                   string
	WALEnabled                  bool
	UrlQueryParams              map[string][]string
	SkipMigrations              bool
	MigrationLockAttemptTimeout int
	// SQLite only
	QueryRetries int
	// SQLite only
	TransactionRetries int
}
