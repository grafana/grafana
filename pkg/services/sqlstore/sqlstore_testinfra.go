// This file sets up the test environment for the sqlstore.
// Its intent is to create a database for use in tests. This database should be entirely isolated and possible to use in parallel tests.

package sqlstore

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// TestingTB is an interface that is implemented by *testing.T and *testing.B. Similar to testing.TB.
type TestingTB interface {
	// Helper marks the calling function as a test helper function. See also (*testing.T).Helper.
	Helper()
	// Cleanup registers a new function the testing suite will run after the test completes. See also (*testing.T).Cleanup.
	Cleanup(func())
	// Fatalf logs a message and marks the test as failed. The syntax is similar to that of fmt.Printf. See also (*testing.T).Fatalf.
	Fatalf(format string, args ...any)
	// Logf formats and logs its arguments. See also (*testing.T).Logf.
	Logf(format string, args ...any)
	// Context returns a context that is canceled just before Cleanup-registered functions are called. See also (*testing.T).Context.
	Context() context.Context
}

var _ TestingTB = (testing.TB)(nil)

type testOptions struct {
	FeatureFlags     map[string]bool
	MigratorFactory  func(featuremgmt.FeatureToggles) registry.DatabaseMigrator
	Tracer           tracing.Tracer
	Bus              bus.Bus
	NoDefaultUserOrg bool
	Cfg              *setting.Cfg
	Truncate         bool
}

type TestOption func(*testOptions)

// WithFeatureFlags adds the feature flags to the other flags already set with a value of true.
func WithFeatureFlags(flags ...string) TestOption {
	return func(o *testOptions) {
		for _, flag := range flags {
			o.FeatureFlags[flag] = true
		}
	}
}

// WithoutFeatureFlags adds the feature flags to the other flags already set with a value of true.
func WithoutFeatureFlags(flags ...string) TestOption {
	return func(o *testOptions) {
		for _, flag := range flags {
			o.FeatureFlags[flag] = false
		}
	}
}

// WithFeatureFlag sets the flag to the specified value.
func WithFeatureFlag(flag string, val bool) TestOption {
	return func(o *testOptions) {
		o.FeatureFlags[flag] = val
	}
}

// WithOSSMigrations sets the migrator to the OSS migrations.
// This effectively works _after_ all other options are passed, including WithMigrator.
func WithOSSMigrations() TestOption {
	return func(o *testOptions) {
		o.MigratorFactory = func(ft featuremgmt.FeatureToggles) registry.DatabaseMigrator {
			return migrations.ProvideOSSMigrations(ft) // the return type isn't exactly registry.DatabaseMigrator, hence the wrapper.
		}
	}
}

func WithMigrator(migrator registry.DatabaseMigrator) TestOption {
	return func(o *testOptions) {
		o.MigratorFactory = func(_ featuremgmt.FeatureToggles) registry.DatabaseMigrator {
			return migrator
		}
	}
}

// WithoutMigrator explicitly opts out of migrations.
func WithoutMigrator() TestOption {
	return WithMigrator(nil)
}

func WithTracer(tracer tracing.Tracer, bus bus.Bus) TestOption {
	return func(o *testOptions) {
		o.Tracer = tracer
		o.Bus = bus
	}
}

func WithoutDefaultOrgAndUser() TestOption {
	return func(o *testOptions) {
		o.NoDefaultUserOrg = true
	}
}

// WithCfg configures a *setting.Cfg to base the configuration upon.
// Note that if this is set, we will modify the configuration object's [database] section.
func WithCfg(cfg *setting.Cfg) TestOption {
	return func(o *testOptions) {
		o.Cfg = cfg
	}
}

// WithTruncation enables truncating the entire database's tables after setup.
// This is similar to the old infrastructure's behaviour.
//
// Most tests should just run with the data the migrations create, as they should assume a position very close to a customer's database, and customers are not going to truncate their database before updating.
func WithTruncation() TestOption {
	return func(o *testOptions) {
		o.Truncate = true
	}
}

// NewTestStore creates a new SQLStore with a test database. It is useful in parallel tests.
// All cleanup is scheduled via the passed TestingTB; the caller does not need to do anything about it.
// Temporary, clean databases are created for each test, and are destroyed when the test finishes.
// When using subtests, create a new store for each subtest instead of sharing one across the entire test.
// By default, OSS migrations are run. Enterprise migrations need to be opted into manually. Migrations can also be opted out of entirely.
//
// The opts are called in order. That means that a destructive option should be added last if you want it to be truly destructive.
func NewTestStore(tb TestingTB, opts ...TestOption) *SQLStore {
	tb.Helper()

	tracer := tracing.InitializeTracerForTest()
	options := &testOptions{
		FeatureFlags:     make(map[string]bool),
		Tracer:           tracer,
		Bus:              bus.ProvideBus(tracer),
		NoDefaultUserOrg: true,
	}
	WithOSSMigrations()(options) // Assign some default migrations
	for _, opt := range opts {
		opt(options)
	}

	features := newFeatureToggles(options.FeatureFlags)
	testDB, err := createTemporaryDatabase(tb)
	if err != nil {
		tb.Fatalf("failed to create a temporary database: %v", err)
		panic("unreachable")
	}

	cfg, err := newTestCfg(options.Cfg, features, testDB)
	if err != nil {
		tb.Fatalf("failed to create a test cfg: %v", err)
		panic("unreachable")
	}

	engine, err := xorm.NewEngine(testDB.Driver, testDB.Conn)
	if err != nil {
		tb.Fatalf("failed to connect to temporary database: %v", err)
		panic("unreachable")
	}
	tb.Cleanup(func() {
		_ = engine.Close()
	})
	engine.DatabaseTZ = time.UTC
	engine.TZLocation = time.UTC

	cfgDBSec := cfg.Raw.Section("database")
	shouldEnsure := fmt.Sprintf("%t", !options.NoDefaultUserOrg && !options.Truncate)
	cfgDBSec.Key("ensure_default_org_and_user").SetValue(shouldEnsure)

	store, err := newStore(cfg, engine, features, options.MigratorFactory(features),
		options.Bus, options.Tracer)
	if err != nil {
		tb.Fatalf("failed to create a new SQLStore: %v", err)
		panic("unreachable")
	}

	if err := store.Migrate(false); err != nil {
		tb.Fatalf("failed to migrate database: %v", err)
		panic("unreachable")
	}

	if options.Truncate {
		if err := store.dialect.TruncateDBTables(store.GetEngine()); err != nil {
			tb.Fatalf("failed to truncate DB tables after migrations: %v", err)
			panic("unreachable")
		}
		testSQLStore.engine.ResetSequenceGenerator()
	}

	return store
}

func getTestDBType() string {
	dbType := "sqlite3"

	if db, present := os.LookupEnv("GRAFANA_TEST_DB"); present {
		dbType = db
	}
	return dbType
}

func newFeatureToggles(toggles map[string]bool) featuremgmt.FeatureToggles {
	spec := make([]any, 0, len(toggles)*2)
	for flag, val := range toggles {
		spec = append(spec, flag, val)
	}
	return featuremgmt.WithFeatures(spec...)
}

func newTestCfg(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	testDB *testDB,
) (*setting.Cfg, error) {
	if cfg == nil {
		cfg = setting.NewCfg()
	}
	cfg.IsFeatureToggleEnabled = features.IsEnabledGlobally

	sec, err := cfg.Raw.NewSection("database")
	if err != nil {
		return nil, fmt.Errorf("failed to create database section in config: %w", err)
	}

	if _, err := sec.NewKey("type", getTestDBType()); err != nil {
		return nil, fmt.Errorf("failed to set database.type: %w", err)
	}
	if _, err := sec.NewKey("connection_string", testDB.Conn); err != nil {
		return nil, fmt.Errorf("failed to set database.connection_string: %w", err)
	}
	if _, err := sec.NewKey("path", testDB.Path); err != nil {
		return nil, fmt.Errorf("failed to set database.path: %w", err)
	}

	return cfg, nil
}

type testDB struct {
	Driver string
	Conn   string
	Path   string
}

// createTemporaryDatabase returns a connection string to a temporary database.
// The database is created by us, and destroyed by the TestingTB cleanup function.
// This means every database is entirely empty and isolated. Migrations are not run here.
// If cleanup fails, the database and its data may be partially or entirely left behind.
//
// We assume the database credentials we are given in environment variables are those of a super user who can create databases.
func createTemporaryDatabase(tb TestingTB) (*testDB, error) {
	dbType := getTestDBType()
	if dbType == "sqlite3" {
		// SQLite doesn't have a concept of a database server, so we always create a new file with no connections required.
		return newSQLite3DB(tb)
	}

	// On the remaining databases, we first connect to the configured credentials, create a new database, then return this new database's info as a connection string.
	// We use databases rather than schemas as MySQL has no concept of schemas, so this aligns them more closely.
	var driver, connString string
	switch dbType {
	case "sqlite3":
		panic("unreachable; handled above")
	case "mysql":
		driver, connString = newMySQLConnString(env("MYSQL_DB", "grafana_tests"))
	case "postgres":
		driver, connString = newPostgresConnString(env("POSTGRES_DB", "grafanatest"))
	default:
		return nil, fmt.Errorf("unknown test db type: %s", dbType)
	}

	// We don't need the ORM here, but it's handy to connect with as we implicitly assert our driver names are correct.
	engine, err := xorm.NewEngine(driver, connString)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	defer func() {
		// If the engine closing isn't possible to do cleanly, we don't mind.
		_ = engine.Close()
	}()

	id := generateDatabaseName()
	_, err = engine.Exec("CREATE DATABASE " + id)
	if err != nil {
		return nil, fmt.Errorf("failed to create a new database %s: %w", id, err)
	}
	tb.Cleanup(func() {
		engine, err := xorm.NewEngine(driver, connString)
		if err == nil {
			// Clean up after ourselves at the end as well.
			_, _ = engine.Exec("DROP DATABASE " + id)
			_ = engine.Close()
		}
	})

	db := &testDB{}
	switch dbType {
	case "mysql":
		db.Driver, db.Conn = newMySQLConnString(id)
	case "postgres":
		db.Driver, db.Conn = newPostgresConnString(id)
	default:
		panic("unreachable; handled in the switch statement above")
	}
	return db, nil
}

func generateDatabaseName() string {
	// The database name has to be unique amongst all tests. It is highly unlikely we will have a collision here.
	// The database name has to be <= 64 chars long on MySQL, and <= 31 chars on Postgres.
	return "grafana_test_" + randomLowerHex(18)
}

func env(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}

func newPostgresConnString(dbname string) (driver, connString string) {
	return "postgres", fmt.Sprintf("user=%s password=%s host=%s port=%s dbname=%s sslmode=%s",
		env("POSTGRES_USER", "grafanatest"),
		env("POSTGRES_PASSWORD", "grafanatest"),
		env("POSTGRES_HOST", "localhost"),
		env("POSTGRES_PORT", "5432"),
		dbname,
		env("POSTGRES_SSL", "disable"),
	)
}

func newMySQLConnString(dbname string) (driver, connString string) {
	// The parseTime=true parameter is required for MySQL to parse time.Time values correctly.
	// It converts the timezone of the time.Time to the configured timezone of the connection.
	return "mysql", fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?collation=utf8mb4_unicode_ci&sql_mode='ANSI_QUOTES'&parseTime=true",
		env("MYSQL_USER", "root"),
		env("MYSQL_PASSWORD", "rootpass"),
		env("MYSQL_HOST", "localhost"),
		env("MYSQL_PORT", "3306"),
		dbname,
	)
}

func newSQLite3DB(tb TestingTB) (*testDB, error) {
	if os.Getenv("SQLITE_INMEMORY") == "true" {
		return &testDB{Driver: "sqlite3", Conn: "file::memory:"}, nil
	}

	tmp, err := os.CreateTemp("", "grafana-test-sqlite-*.db")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	tb.Cleanup(func() {
		// Do best efforts at cleaning up after ourselves.
		_ = tmp.Close()
		_ = os.Remove(tmp.Name())
	})

	// For tests, set sync=OFF for faster commits. Reference: https://www.sqlite.org/pragma.html#pragma_synchronous
	// Sync is used in more production-y environments to avoid the database becoming corrupted. Test databases are fine to break.
	return &testDB{
		Driver: "sqlite3",
		Path:   tmp.Name(),
		Conn:   fmt.Sprintf("file:%s?cache=private&mode=rwc&_journal_mode=WAL&_synchronous=OFF", tmp.Name()),
	}, nil
}

func randomLowerHex(length int) string {
	buf := make([]byte, length)
	_, err := rand.Read(buf)
	if err != nil {
		panic("invariant: failed to read random bytes -- crypto/rand's documentation says this cannot happen")
	}

	return hex.EncodeToString(buf)[:length]
}
