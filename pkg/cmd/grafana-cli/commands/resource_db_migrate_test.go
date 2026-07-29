package commands

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// kvTables are the tables the unified storage KV backend reads and writes.
var kvTables = []string{
	"resource_history",
	"resource_events",
	"pending_tenant_deletions",
	"kv_leases",
	"search_snapshot_manifest",
	"search_snapshot_data",
	"resource_stats_daily",
	"resource_stats_aggregates",
}

func TestIntegrationResourceDbMigrate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	cfg, engine := newEmptyResourceDB(t)

	require.NoError(t, runResourceDbMigrations(ctx, cfg))

	// The resource migration log is populated and every migration succeeded.
	total, err := engine.Table(resourceMigrationLogTable).Count()
	require.NoError(t, err)
	require.NotZero(t, total, "no migrations were recorded")

	succeeded, err := engine.Table(resourceMigrationLogTable).Where("success = ?", true).Count()
	require.NoError(t, err)
	require.Equal(t, total, succeeded, "some migrations were recorded as failed")

	for _, table := range kvTables {
		exists, err := engine.IsTableExist(table)
		require.NoError(t, err)
		require.True(t, exists, "table %s was not created", table)
	}

	// The main Grafana schema must be untouched: this command exists to migrate
	// databases that hold unified storage tables only.
	for _, table := range []string{"migration_log", "user", "dashboard", "org"} {
		exists, err := engine.IsTableExist(table)
		require.NoError(t, err)
		require.False(t, exists, "table %s should not have been created", table)
	}

	// Running again applies nothing and records nothing new.
	require.NoError(t, runResourceDbMigrations(ctx, cfg))
	after, err := engine.Table(resourceMigrationLogTable).Count()
	require.NoError(t, err)
	require.Equal(t, total, after)
}

func TestIntegrationResourceDbMigrateIgnoresStorageType(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	cfg, engine := newEmptyResourceDB(t)
	apiserverSec, err := cfg.Raw.NewSection("grafana-apiserver")
	require.NoError(t, err)
	_, err = apiserverSec.NewKey("storage_type", "unified-kv-grpc")
	require.NoError(t, err)

	require.NoError(t, runResourceDbMigrations(context.Background(), cfg))

	exists, err := engine.IsTableExist("resource_history")
	require.NoError(t, err)
	require.True(t, exists)
}

func TestIntegrationResourceDbMigrateSkipMigrations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	cfg, engine := newEmptyResourceDB(t)
	// skip_migrations only disables main Grafana schema migrations; resource
	// migrations must still run when it is enabled.
	_, err := cfg.Raw.Section("database").NewKey("skip_migrations", "true")
	require.NoError(t, err)

	require.NoError(t, runResourceDbMigrations(context.Background(), cfg))

	exists, err := engine.IsTableExist("resource_history")
	require.NoError(t, err)
	require.True(t, exists)

	for _, table := range []string{"migration_log", "user", "dashboard", "org"} {
		exists, err := engine.IsTableExist(table)
		require.NoError(t, err)
		require.False(t, exists, "table %s should not have been created", table)
	}
}

func TestRunResourceDbMigrationsErrors(t *testing.T) {
	t.Run("no database configured", func(t *testing.T) {
		err := runResourceDbMigrations(context.Background(), setting.NewCfg())
		require.ErrorContains(t, err, "failed to configure the resource database")
	})

	t.Run("provider returns no database", func(t *testing.T) {
		restore := swapResourceDBProvider(t, func(*setting.Cfg) (db.DBProvider, error) {
			return nil, nil
		})
		defer restore()

		err := runResourceDbMigrations(context.Background(), setting.NewCfg())
		require.ErrorContains(t, err, "no resource database configured")
	})

	t.Run("migration failure is surfaced", func(t *testing.T) {
		restore := swapResourceDBProvider(t, func(*setting.Cfg) (db.DBProvider, error) {
			return failingProvider{err: errors.New("boom")}, nil
		})
		defer restore()

		err := runResourceDbMigrations(context.Background(), setting.NewCfg())
		require.ErrorContains(t, err, "failed to migrate the resource database")
		require.ErrorContains(t, err, "boom")
	})
}

type failingProvider struct {
	err error
}

func (p failingProvider) Init(context.Context) (db.DB, error) { return nil, p.err }

func swapResourceDBProvider(t *testing.T, fn func(*setting.Cfg) (db.DBProvider, error)) func() {
	t.Helper()
	previous := resourceDBProvider
	resourceDBProvider = fn
	return func() { resourceDBProvider = previous }
}

func newEmptyResourceDB(t *testing.T) (*setting.Cfg, *xorm.Engine) {
	t.Helper()

	dbType := os.Getenv("GRAFANA_TEST_DB")
	if dbType == "" {
		dbType = "sqlite3"
	}

	cfg := setting.NewCfg()
	sec, err := cfg.Raw.NewSection("database")
	require.NoError(t, err)
	setKey := func(key, value string) {
		_, err := sec.NewKey(key, value)
		require.NoError(t, err)
	}
	setKey("type", dbType)

	var connString string
	switch dbType {
	case "sqlite3":
		connString = fmt.Sprintf("file:%s?cache=shared", filepath.Join(t.TempDir(), "resource.db"))
		setKey("path", connString)
	case "mysql", "postgres":
		connString = createEmptyTestDatabase(t, dbType)
	default:
		t.Fatalf("unsupported GRAFANA_TEST_DB: %s", dbType)
	}
	setKey("connection_string", connString)

	engine, err := xorm.NewEngine(dbType, connString)
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })

	return cfg, engine
}

func createEmptyTestDatabase(t *testing.T, dbType string) string {
	t.Helper()

	name := fmt.Sprintf("resource_mig_%d", os.Getpid())

	var adminConn, dbConn string
	switch dbType {
	case "mysql":
		dsn := "%s:%s@tcp(%s:%s)/%s?collation=utf8mb4_unicode_ci&parseTime=true"
		user := env("MYSQL_USER", "root")
		pass := env("MYSQL_PASSWORD", "rootpass")
		host := env("MYSQL_HOST", "localhost")
		port := env("MYSQL_PORT", "3306")
		adminConn = fmt.Sprintf(dsn, user, pass, host, port, env("MYSQL_DB", "grafana_tests"))
		dbConn = fmt.Sprintf(dsn, user, pass, host, port, name)
	case "postgres":
		dsn := "user=%s password=%s host=%s port=%s dbname=%s sslmode=disable"
		user := env("POSTGRES_USER", "grafanatest")
		pass := env("POSTGRES_PASSWORD", "grafanatest")
		host := env("POSTGRES_HOST", "localhost")
		port := env("POSTGRES_PORT", "5432")
		adminConn = fmt.Sprintf(dsn, user, pass, host, port, env("POSTGRES_DB", "grafanatest"))
		dbConn = fmt.Sprintf(dsn, user, pass, host, port, name)
	}

	admin, err := xorm.NewEngine(dbType, adminConn)
	require.NoError(t, err)
	defer func() { _ = admin.Close() }()

	_, err = admin.Exec("DROP DATABASE IF EXISTS " + name)
	require.NoError(t, err)
	_, err = admin.Exec("CREATE DATABASE " + name)
	require.NoError(t, err)
	t.Cleanup(func() {
		admin, err := xorm.NewEngine(dbType, adminConn)
		if err != nil {
			return
		}
		defer func() { _ = admin.Close() }()
		_, _ = admin.Exec("DROP DATABASE IF EXISTS " + name)
	})

	return dbConn
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
