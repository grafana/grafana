package sqlstore

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/dlmiddlecote/sqlstats"
	"github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"xorm.io/core"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/localcache"
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
	"github.com/grafana/grafana/pkg/util"
)

// ContextSessionKey is used as key to save values in `context.Context`
type ContextSessionKey struct{}

type SQLStore struct {
	Cfg          *setting.Cfg
	sqlxsession  *session.SessionDB
	CacheService *localcache.CacheService

	bus                         bus.Bus
	dbCfg                       DatabaseConfig
	engine                      *xorm.Engine
	log                         log.Logger
	Dialect                     migrator.Dialect
	skipEnsureDefaultOrgAndUser bool
	migrations                  registry.DatabaseMigrator
	tracer                      tracing.Tracer
}

func ProvideService(cfg *setting.Cfg, cacheService *localcache.CacheService, migrations registry.DatabaseMigrator, bus bus.Bus, tracer tracing.Tracer) (*SQLStore, error) {
	// This change will make xorm use an empty default schema for postgres and
	// by that mimic the functionality of how it was functioning before
	// xorm's changes above.
	xorm.DefaultPostgresSchema = ""
	s, err := newSQLStore(cfg, cacheService, nil, migrations, bus, tracer)
	if err != nil {
		return nil, err
	}

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
	prometheus.MustRegister(sqlstats.NewStatsCollector("grafana", db))
	// TODO: deprecate/remove these metrics
	prometheus.MustRegister(newSQLStoreMetrics(db))

	return s, nil
}

func ProvideServiceForTests(migrations registry.DatabaseMigrator) (*SQLStore, error) {
	return initTestDB(migrations, InitTestDBOpt{EnsureDefaultOrgAndUser: true})
}

func newSQLStore(cfg *setting.Cfg, cacheService *localcache.CacheService, engine *xorm.Engine,
	migrations registry.DatabaseMigrator, bus bus.Bus, tracer tracing.Tracer, opts ...InitTestDBOpt) (*SQLStore, error) {
	ss := &SQLStore{
		Cfg:                         cfg,
		CacheService:                cacheService,
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

	ss.Dialect = migrator.NewDialect(ss.engine)

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

func (ss *SQLStore) buildExtraConnectionString(sep rune) string {
	if ss.dbCfg.UrlQueryParams == nil {
		return ""
	}

	var sb strings.Builder
	for key, values := range ss.dbCfg.UrlQueryParams {
		for _, value := range values {
			sb.WriteRune(sep)
			sb.WriteString(key)
			sb.WriteRune('=')
			sb.WriteString(value)
		}
	}
	return sb.String()
}

func (ss *SQLStore) buildConnectionString() (string, error) {
	if err := ss.readConfig(); err != nil {
		return "", err
	}

	cnnstr := ss.dbCfg.ConnectionString

	// special case used by integration tests
	if cnnstr != "" {
		return cnnstr, nil
	}

	switch ss.dbCfg.Type {
	case migrator.MySQL:
		protocol := "tcp"
		if strings.HasPrefix(ss.dbCfg.Host, "/") {
			protocol = "unix"
		}

		cnnstr = fmt.Sprintf("%s:%s@%s(%s)/%s?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true",
			ss.dbCfg.User, ss.dbCfg.Pwd, protocol, ss.dbCfg.Host, ss.dbCfg.Name)

		if ss.dbCfg.SslMode == "true" || ss.dbCfg.SslMode == "skip-verify" {
			tlsCert, err := makeCert(ss.dbCfg)
			if err != nil {
				return "", err
			}
			if err := mysql.RegisterTLSConfig("custom", tlsCert); err != nil {
				return "", err
			}

			cnnstr += "&tls=custom"
		}

		if isolation := ss.dbCfg.IsolationLevel; isolation != "" {
			val := url.QueryEscape(fmt.Sprintf("'%s'", isolation))
			cnnstr += fmt.Sprintf("&tx_isolation=%s", val)
		}

		if ss.Cfg.IsFeatureToggleEnabled(featuremgmt.FlagMysqlAnsiQuotes) || ss.Cfg.IsFeatureToggleEnabled(featuremgmt.FlagNewDBLibrary) {
			cnnstr += "&sql_mode='ANSI_QUOTES'"
		}

		if ss.Cfg.IsFeatureToggleEnabled(featuremgmt.FlagNewDBLibrary) {
			cnnstr += "&parseTime=true"
		}

		cnnstr += ss.buildExtraConnectionString('&')
	case migrator.Postgres:
		addr, err := util.SplitHostPortDefault(ss.dbCfg.Host, "127.0.0.1", "5432")
		if err != nil {
			return "", fmt.Errorf("invalid host specifier '%s': %w", ss.dbCfg.Host, err)
		}

		if ss.dbCfg.Pwd == "" {
			ss.dbCfg.Pwd = "''"
		}
		if ss.dbCfg.User == "" {
			ss.dbCfg.User = "''"
		}
		cnnstr = fmt.Sprintf("user=%s password=%s host=%s port=%s dbname=%s sslmode=%s sslcert=%s sslkey=%s sslrootcert=%s",
			ss.dbCfg.User, ss.dbCfg.Pwd, addr.Host, addr.Port, ss.dbCfg.Name, ss.dbCfg.SslMode, ss.dbCfg.ClientCertPath,
			ss.dbCfg.ClientKeyPath, ss.dbCfg.CaCertPath)

		cnnstr += ss.buildExtraConnectionString(' ')
	case migrator.SQLite:
		// special case for tests
		if !filepath.IsAbs(ss.dbCfg.Path) {
			ss.dbCfg.Path = filepath.Join(ss.Cfg.DataPath, ss.dbCfg.Path)
		}
		if err := os.MkdirAll(path.Dir(ss.dbCfg.Path), os.ModePerm); err != nil {
			return "", err
		}

		cnnstr = fmt.Sprintf("file:%s?cache=%s&mode=rwc", ss.dbCfg.Path, ss.dbCfg.CacheMode)

		if ss.dbCfg.WALEnabled {
			cnnstr += "&_journal_mode=WAL"
		}

		cnnstr += ss.buildExtraConnectionString('&')
	default:
		return "", fmt.Errorf("unknown database type: %s", ss.dbCfg.Type)
	}

	return cnnstr, nil
}

// initEngine initializes ss.engine.
func (ss *SQLStore) initEngine(engine *xorm.Engine) error {
	if ss.engine != nil {
		ss.log.Debug("Already connected to database")
		return nil
	}

	connectionString, err := ss.buildConnectionString()
	if err != nil {
		return err
	}

	if ss.Cfg.IsFeatureToggleEnabled(featuremgmt.FlagDatabaseMetrics) {
		ss.dbCfg.Type = WrapDatabaseDriverWithHooks(ss.dbCfg.Type, ss.tracer)
	}

	ss.log.Info("Connecting to DB", "dbtype", ss.dbCfg.Type)
	if ss.dbCfg.Type == migrator.SQLite && strings.HasPrefix(connectionString, "file:") &&
		!strings.HasPrefix(connectionString, "file::memory:") {
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
		engine, err = xorm.NewEngine(ss.dbCfg.Type, connectionString)
		if err != nil {
			return err
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

// ITestDB is an interface of arguments for testing db
type ITestDB interface {
	Helper()
	Fatalf(format string, args ...interface{})
	Logf(format string, args ...interface{})
	Log(args ...interface{})
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
	featuremgmt.FlagDashboardPreviews,
	featuremgmt.FlagPanelTitleSearch,
	featuremgmt.FlagEntityStore,
}

// InitTestDBWithMigration initializes the test DB given custom migrations.
func InitTestDBWithMigration(t ITestDB, migration registry.DatabaseMigrator, opts ...InitTestDBOpt) *SQLStore {
	t.Helper()
	store, err := initTestDB(migration, opts...)
	if err != nil {
		t.Fatalf("failed to initialize sql store: %s", err)
	}
	return store
}

// InitTestDB initializes the test DB.
func InitTestDB(t ITestDB, opts ...InitTestDBOpt) *SQLStore {
	t.Helper()
	store, err := initTestDB(&migrations.OSSMigrations{}, opts...)
	if err != nil {
		t.Fatalf("failed to initialize sql store: %s", err)
	}
	return store
}

func InitTestDBWithCfg(t ITestDB, opts ...InitTestDBOpt) (*SQLStore, *setting.Cfg) {
	store := InitTestDB(t, opts...)
	return store, store.Cfg
}

func initTestDB(migration registry.DatabaseMigrator, opts ...InitTestDBOpt) (*SQLStore, error) {
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

		// need to get engine to clean db before we init
		engine, err := xorm.NewEngine(dbType, sec.Key("connection_string").String())
		if err != nil {
			return nil, err
		}

		engine.DatabaseTZ = time.UTC
		engine.TZLocation = time.UTC

		tracer := tracing.InitializeTracerForTest()
		bus := bus.ProvideBus(tracer)
		testSQLStore, err = newSQLStore(cfg, localcache.New(5*time.Minute, 10*time.Minute), engine, migration, bus, tracer, opts...)
		if err != nil {
			return nil, err
		}

		if err := testSQLStore.Migrate(false); err != nil {
			return nil, err
		}

		if err := testSQLStore.Dialect.TruncateDBTables(); err != nil {
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

	testSQLStore.Cfg.IsFeatureToggleEnabled = func(key string) bool {
		for _, enabledFeature := range features {
			if enabledFeature == key {
				return true
			}
		}
		return false
	}

	if err := testSQLStore.Dialect.TruncateDBTables(); err != nil {
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
