// This file sets up the test environment for the sqlstore.
// Its intent is to create a database for use in tests. This database should be entirely isolated and possible to use in parallel tests.

package sqlstore

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
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

// dbTemplate is one pre-migrated template; ref meaning is engine-specific (sqlite: file path; postgres/mysql: template database name).
type dbTemplate struct {
	once sync.Once
	ref  string
	err  error
}

// dbTemplates caches templates per fingerprint key, built at most once per process each; clones carry migration_log so Migrate near-no-ops.
var dbTemplates sync.Map

// dbTemplateRequest asks createTemporaryDatabase for a database pre-migrated with the given migration set.
type dbTemplateRequest struct {
	key        string // fingerprint: driver + hash of the set's ordered migration IDs
	dbMigrator registry.DatabaseMigrator
}

// getDBTemplate returns the template ref for key, building it once per process via build.
func getDBTemplate(key string, build func() (string, error)) (string, error) {
	v, _ := dbTemplates.LoadOrStore(key, &dbTemplate{})
	t := v.(*dbTemplate)
	t.once.Do(func() {
		t.ref, t.err = build()
	})
	return t.ref, t.err
}

// dbTemplateFingerprint identifies a migration set by its ordered migration IDs — the same identity migration_log uses, so cache validity and skip-logic agree by construction.
func dbTemplateFingerprint(dbm registry.DatabaseMigrator) (key string, err error) {
	defer func() {
		// AddMigration panics on ID conflicts; a set we cannot enumerate is a set we do not cache.
		if r := recover(); r != nil {
			err = fmt.Errorf("fingerprint registration panicked: %v", r)
		}
	}()

	dbType := getTestDBType()
	ids := migrator.MigrationIDs(dbType, dbm.AddMigration)
	sum := sha256.Sum256([]byte(strings.Join(ids, "\n")))
	return dbType + ":" + hex.EncodeToString(sum[:8]), nil
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
	dbMigrator := options.MigratorFactory(features)

	// Opt-in: GRAFANA_TEST_DB_TEMPLATE=true (read per call, for t.Setenv) serves stores from
	// pre-migrated templates. Fresh factory instances per use: AddMigration may mutate its receiver.
	var tmpl *dbTemplateRequest
	if dbMigrator != nil && strings.EqualFold(os.Getenv("GRAFANA_TEST_DB_TEMPLATE"), "true") {
		if key, ferr := dbTemplateFingerprint(options.MigratorFactory(features)); ferr == nil {
			tmpl = &dbTemplateRequest{key: key, dbMigrator: options.MigratorFactory(features)}
		} else {
			tb.Logf("DB template fingerprint unavailable, falling back to running migrations: %v", ferr)
		}
	}

	testDB, err := createTemporaryDatabase(tb, tmpl)
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

	store, err := newStore(cfg, engine, features, dbMigrator,
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
		store.engine.ResetSequenceGenerator()
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
	//nolint:staticcheck // not yet migrated to OpenFeature
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
// Every database is isolated. When tmpl is non-nil, supporting engines return a database
// pre-migrated from a template; otherwise (and on any template failure) it is empty and migrations run normally.
// If cleanup fails, the database and its data may be partially or entirely left behind.
//
// We assume the database credentials we are given in environment variables are those of a super user who can create databases.
func createTemporaryDatabase(tb TestingTB, tmpl *dbTemplateRequest) (*testDB, error) {
	dbType := getTestDBType()
	if dbType == "sqlite3" {
		// SQLite doesn't have a concept of a database server, so we always create a new file with no connections required.
		db, err := newSQLite3DB(tb)
		if err == nil && tmpl != nil && db.Path != "" { // Path=="" is SQLITE_INMEMORY
			if terr := cloneSQLiteTemplate(tb, tmpl, db.Path); terr != nil {
				// Destination is still an empty file; the normal migration path stays correct.
				tb.Logf("sqlite DB template unavailable, falling back to running migrations: %v", terr)
			}
		}
		return db, err
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
	created := false
	if tmpl != nil && dbType == "postgres" {
		// Postgres clones at CREATE time; the template must have zero connections (the builder closes its engine).
		ref, terr := getDBTemplate(tmpl.key, func() (string, error) {
			return buildPostgresTemplate(tmpl.dbMigrator)
		})
		if terr == nil {
			if _, cerr := engine.Exec("CREATE DATABASE " + id + " TEMPLATE " + ref); cerr == nil {
				created = true
			} else {
				tb.Logf("postgres DB template clone failed, falling back to plain create: %v", cerr)
			}
		} else {
			tb.Logf("postgres DB template unavailable, falling back to running migrations: %v", terr)
		}
	}
	if !created {
		if _, err := engine.Exec("CREATE DATABASE " + id); err != nil {
			return nil, fmt.Errorf("failed to create a new database %s: %w", id, err)
		}
	}

	if tmpl != nil && dbType == "mysql" {
		// MySQL has no native clone; copy the template's tables into the fresh database.
		ref, terr := getDBTemplate(tmpl.key, func() (string, error) {
			return buildMySQLTemplate(tmpl.dbMigrator)
		})
		if terr == nil {
			if cerr := copyMySQLDatabase(engine, ref, id); cerr != nil {
				tb.Logf("mysql DB template clone failed, falling back to running migrations: %v", cerr)
				// A partial copy must never reach the migrator: reset to a clean empty database.
				if _, derr := engine.Exec("DROP DATABASE " + id); derr != nil {
					return nil, fmt.Errorf("failed to reset database %s after failed template clone: %w", id, derr)
				}
				if _, rerr := engine.Exec("CREATE DATABASE " + id); rerr != nil {
					return nil, fmt.Errorf("failed to recreate database %s after failed template clone: %w", id, rerr)
				}
			}
		} else {
			tb.Logf("mysql DB template unavailable, falling back to running migrations: %v", terr)
		}
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
	return "mysql", fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?collation=utf8mb4_unicode_ci&sql_mode=ANSI_QUOTES&parseTime=true",
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

// cloneSQLiteTemplate copies the template's file (built once per fingerprint) into dst; on failure dst is reset to empty for safe fallback (only a failed reset is fatal).
func cloneSQLiteTemplate(tb TestingTB, tmpl *dbTemplateRequest, dst string) error {
	tb.Helper()

	ref, err := getDBTemplate(tmpl.key, func() (string, error) {
		return buildSQLiteTemplate(tmpl.dbMigrator, tmpl.key)
	})
	if err != nil {
		return fmt.Errorf("template build failed: %w", err)
	}

	if err := copyFile(ref, dst); err != nil {
		if truncErr := os.Truncate(dst, 0); truncErr != nil {
			tb.Fatalf("failed to reset test database %s after failed template copy: %v (copy error: %v)", dst, truncErr, err)
			panic("unreachable")
		}
		return fmt.Errorf("template copy failed: %w", err)
	}
	return nil
}

// buildPostgresTemplate migrates a fresh template database and closes every connection to
// it (Postgres refuses to clone a template with live connections). The template DB is left behind (PoC: one per package run).
func buildPostgresTemplate(dbm registry.DatabaseMigrator) (name string, err error) {
	defer func() {
		// A panicking build must not poison the sync.Once cache.
		if r := recover(); r != nil {
			err = fmt.Errorf("template build panicked: %v", r)
		}
	}()

	driver, adminConn := newPostgresConnString(env("POSTGRES_DB", "grafanatest"))
	admin, err := xorm.NewEngine(driver, adminConn)
	if err != nil {
		return "", fmt.Errorf("template admin engine: %w", err)
	}
	defer func() {
		_ = admin.Close()
	}()

	name = "grafana_tmpl_" + randomLowerHex(10)
	if _, err := admin.Exec("CREATE DATABASE " + name); err != nil {
		return "", fmt.Errorf("template create database: %w", err)
	}
	dropTemplate := func() { _, _ = admin.Exec("DROP DATABASE " + name) }

	tmplDriver, tmplConn := newPostgresConnString(name)
	templateDB := &testDB{Driver: tmplDriver, Conn: tmplConn}

	features := featuremgmt.WithFeatures()
	cfg, err := newTestCfg(nil, features, templateDB)
	if err != nil {
		dropTemplate()
		return "", fmt.Errorf("template cfg: %w", err)
	}
	// Deterministic template: never seed default org/user; callers apply their own setting per call, after the clone.
	cfg.Raw.Section("database").Key("ensure_default_org_and_user").SetValue("false")

	engine, err := xorm.NewEngine(templateDB.Driver, templateDB.Conn)
	if err != nil {
		dropTemplate()
		return "", fmt.Errorf("template engine: %w", err)
	}
	engine.DatabaseTZ = time.UTC
	engine.TZLocation = time.UTC

	tracer := tracing.InitializeTracerForTest()
	store, err := newStore(cfg, engine, features, dbm, bus.ProvideBus(tracer), tracer)
	if err != nil {
		_ = engine.Close()
		dropTemplate()
		return "", fmt.Errorf("template store: %w", err)
	}
	if err := store.Migrate(false); err != nil {
		_ = engine.Close()
		dropTemplate()
		return "", fmt.Errorf("template migrate: %w", err)
	}

	if err := engine.Close(); err != nil {
		dropTemplate()
		return "", fmt.Errorf("template engine close: %w", err)
	}
	return name, nil
}

// buildMySQLTemplate migrates a fresh template database; it is left behind (PoC: one per package run).
func buildMySQLTemplate(dbm registry.DatabaseMigrator) (name string, err error) {
	defer func() {
		// A panicking build must not poison the sync.Once cache.
		if r := recover(); r != nil {
			err = fmt.Errorf("template build panicked: %v", r)
		}
	}()

	driver, adminConn := newMySQLConnString(env("MYSQL_DB", "grafana_tests"))
	admin, err := xorm.NewEngine(driver, adminConn)
	if err != nil {
		return "", fmt.Errorf("template admin engine: %w", err)
	}
	defer func() {
		_ = admin.Close()
	}()

	name = "grafana_tmpl_" + randomLowerHex(10)
	if _, err := admin.Exec("CREATE DATABASE " + name); err != nil {
		return "", fmt.Errorf("template create database: %w", err)
	}
	dropTemplate := func() { _, _ = admin.Exec("DROP DATABASE " + name) }

	tmplDriver, tmplConn := newMySQLConnString(name)
	templateDB := &testDB{Driver: tmplDriver, Conn: tmplConn}

	features := featuremgmt.WithFeatures()
	cfg, err := newTestCfg(nil, features, templateDB)
	if err != nil {
		dropTemplate()
		return "", fmt.Errorf("template cfg: %w", err)
	}
	// Deterministic template: never seed default org/user; callers apply their own setting per call, after the clone.
	cfg.Raw.Section("database").Key("ensure_default_org_and_user").SetValue("false")

	engine, err := xorm.NewEngine(templateDB.Driver, templateDB.Conn)
	if err != nil {
		dropTemplate()
		return "", fmt.Errorf("template engine: %w", err)
	}
	engine.DatabaseTZ = time.UTC
	engine.TZLocation = time.UTC

	tracer := tracing.InitializeTracerForTest()
	store, err := newStore(cfg, engine, features, dbm, bus.ProvideBus(tracer), tracer)
	if err != nil {
		_ = engine.Close()
		dropTemplate()
		return "", fmt.Errorf("template store: %w", err)
	}
	if err := store.Migrate(false); err != nil {
		_ = engine.Close()
		dropTemplate()
		return "", fmt.Errorf("template migrate: %w", err)
	}
	if err := engine.Close(); err != nil {
		dropTemplate()
		return "", fmt.Errorf("template engine close: %w", err)
	}
	return name, nil
}

// copyMySQLDatabase copies every base table from src into dst (CREATE TABLE LIKE +
// INSERT ... SELECT; foreign keys are not copied — Grafana's schema has none).
func copyMySQLDatabase(admin *xorm.Engine, src, dst string) error {
	sess := admin.NewSession()
	defer sess.Close()
	rows, err := sess.Query("SHOW FULL TABLES FROM `" + src + "` WHERE Table_type = 'BASE TABLE'")
	if err != nil {
		return fmt.Errorf("list template tables: %w", err)
	}

	// Measured: cost is per-table server-side DDL, not round trips; clone ≈ migrate on MySQL.
	for _, row := range rows {
		var table string
		for col, val := range row {
			if strings.HasPrefix(col, "Tables_in_") {
				table = string(val)
				break
			}
		}
		if table == "" {
			return fmt.Errorf("unexpected SHOW FULL TABLES row shape: %v", row)
		}
		if _, err := admin.Exec(fmt.Sprintf("CREATE TABLE `%s`.`%s` LIKE `%s`.`%s`", dst, table, src, table)); err != nil {
			return fmt.Errorf("copy table %s schema: %w", table, err)
		}
		if _, err := admin.Exec(fmt.Sprintf("INSERT INTO `%s`.`%s` SELECT * FROM `%s`.`%s`", dst, table, src, table)); err != nil {
			return fmt.Errorf("copy table %s rows: %w", table, err)
		}
	}
	return nil
}

// buildSQLiteTemplate returns the content-addressed template file, building it if absent
// (migrate → WAL checkpoint → close → atomic rename); partials never exist under the canonical name, so reuse needs no locking.
func buildSQLiteTemplate(dbm registry.DatabaseMigrator, key string) (path string, err error) {
	defer func() {
		// A panicking build must not poison the sync.Once cache.
		if r := recover(); r != nil {
			err = fmt.Errorf("template build panicked: %v", r)
		}
	}()

	canonical := filepath.Join(os.TempDir(), "grafana-test-sqlite-template-"+strings.ReplaceAll(key, ":", "-")+".db")
	if info, serr := os.Stat(canonical); serr == nil && info.Size() > 0 {
		// Cross-process warm start: published templates are complete by construction.
		return canonical, nil
	}

	tmp, err := os.CreateTemp(os.TempDir(), "grafana-test-sqlite-tmplbuild-*.db")
	if err != nil {
		return "", fmt.Errorf("create template file: %w", err)
	}
	removeTemplate := func() { _ = os.Remove(tmp.Name()) }
	if err := tmp.Close(); err != nil {
		removeTemplate()
		return "", fmt.Errorf("close template file handle: %w", err)
	}

	templateDB := &testDB{
		Driver: "sqlite3",
		Path:   tmp.Name(),
		Conn:   fmt.Sprintf("file:%s?cache=private&mode=rwc&_journal_mode=WAL&_synchronous=OFF", tmp.Name()),
	}

	features := featuremgmt.WithFeatures()
	cfg, err := newTestCfg(nil, features, templateDB)
	if err != nil {
		removeTemplate()
		return "", fmt.Errorf("template cfg: %w", err)
	}
	// Deterministic template: never seed default org/user; callers apply their own setting per call, after the copy.
	cfg.Raw.Section("database").Key("ensure_default_org_and_user").SetValue("false")

	engine, err := xorm.NewEngine(templateDB.Driver, templateDB.Conn)
	if err != nil {
		removeTemplate()
		return "", fmt.Errorf("template engine: %w", err)
	}
	defer func() {
		_ = engine.Close()
	}()
	engine.DatabaseTZ = time.UTC
	engine.TZLocation = time.UTC

	tracer := tracing.InitializeTracerForTest()
	store, err := newStore(cfg, engine, features, dbm, bus.ProvideBus(tracer), tracer)
	if err != nil {
		removeTemplate()
		return "", fmt.Errorf("template store: %w", err)
	}
	if err := store.Migrate(false); err != nil {
		removeTemplate()
		return "", fmt.Errorf("template migrate: %w", err)
	}

	// Fold the WAL into the main file so a single-file copy is a complete database.
	if _, err := engine.Exec("PRAGMA wal_checkpoint(TRUNCATE)"); err != nil {
		removeTemplate()
		return "", fmt.Errorf("template WAL checkpoint: %w", err)
	}
	if err := engine.Close(); err != nil {
		removeTemplate()
		return "", fmt.Errorf("template engine close: %w", err)
	}

	if rerr := os.Rename(tmp.Name(), canonical); rerr != nil {
		removeTemplate()
		// A concurrent publisher (or Windows file lock) may have won; a complete canonical is fine either way.
		if info, serr := os.Stat(canonical); serr == nil && info.Size() > 0 {
			return canonical, nil
		}
		return "", fmt.Errorf("template publish: %w", rerr)
	}
	return canonical, nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src) //nolint:gosec // both paths are test-infra-generated temp files, not user input
	if err != nil {
		return err
	}
	defer func() {
		_ = in.Close()
	}()

	// Truncate rather than recreate: os.CreateTemp's handle on dst stays open until test cleanup.
	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_TRUNC, 0) //nolint:gosec // see above
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		_ = out.Close()
		return err
	}
	return out.Close()
}

func randomLowerHex(length int) string {
	buf := make([]byte, length)
	_, err := rand.Read(buf)
	if err != nil {
		panic("invariant: failed to read random bytes -- crypto/rand's documentation says this cannot happen")
	}

	return hex.EncodeToString(buf)[:length]
}
