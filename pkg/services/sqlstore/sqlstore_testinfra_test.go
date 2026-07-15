package sqlstore_test

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// Ensure that we can get any connection at all.
// If this test fails, it may be sensible to ignore a lot of other test failures as they may be rooted in this.
func TestIntegrationTempDatabaseConnect(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := sqlstore.NewTestStore(t, sqlstore.WithoutMigrator())
	err := sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Query("SELECT 1")
		return err
	})
	require.NoError(t, err, "failed to execute a SELECT 1")
}

func TestIntegrationTempDatabaseSQLiteSettings(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Setenv("GRAFANA_TEST_DB", "sqlite3")
	t.Setenv("SQLITE_INMEMORY", "false")
	t.Setenv("SQLITE_TEST_DB", "")

	t.Run("isolated test store", func(t *testing.T) {
		store := sqlstore.NewTestStore(t, sqlstore.WithoutMigrator())
		assertSQLiteTestSettings(t, store.GetEngine().DB().DB)
	})

	t.Run("legacy test store", func(t *testing.T) {
		testDB, err := sqlutil.GetTestDB("sqlite3")
		require.NoError(t, err)
		t.Cleanup(testDB.Cleanup)

		db, err := sql.Open(testDB.DriverName, testDB.ConnStr)
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, db.Close()) })

		assertSQLiteTestSettings(t, db)
	})
}

func assertSQLiteTestSettings(t *testing.T, db *sql.DB) {
	t.Helper()

	db.SetMaxOpenConns(2)
	db.SetMaxIdleConns(2)

	connections := make([]*sql.Conn, 2)
	for i := range connections {
		conn, err := db.Conn(t.Context())
		require.NoError(t, err)
		connections[i] = conn
		t.Cleanup(func() { _ = conn.Close() })
	}

	settings := []struct {
		pragma string
		want   any
	}{
		{pragma: "busy_timeout", want: int64(7500)},
		{pragma: "cache_size", want: int64(134217728)},
		{pragma: "journal_mode", want: "wal"},
		{pragma: "mmap_size", want: int64(134217728)},
		{pragma: "synchronous", want: int64(0)},
		{pragma: "temp_store", want: int64(2)},
	}
	for i, conn := range connections {
		for _, setting := range settings {
			var got any
			require.NoError(t, conn.QueryRowContext(t.Context(), "PRAGMA "+setting.pragma).Scan(&got))
			require.Equal(t, setting.want, got, "unexpected PRAGMA %s on connection %d", setting.pragma, i)
		}
		require.NoError(t, conn.Close())
	}
}

// Ensure that migrations work on the database.
// If this test fails, it may be sensible to ignore a lot of other test failures as they may be rooted in this.
// This only applies OSS migrations, with no feature flags.
func TestIntegrationTempDatabaseOSSMigrate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	_ = sqlstore.NewTestStore(t, sqlstore.WithOSSMigrations())
}

func TestIntegrationUniqueConstraintViolation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testCases := []struct {
		desc string
		f    func(t *testing.T, sess *sqlstore.DBSession, dialect migrator.Dialect) error
	}{
		{
			desc: "successfully detect primary key violations",
			f: func(t *testing.T, sess *sqlstore.DBSession, dialect migrator.Dialect) error {
				// Attempt to insert org with provided ID (primary key) twice
				now := time.Now()
				org := org.Org{Name: "test org primary key violation", Created: now, Updated: now, ID: 42}
				err := sess.InsertId(&org, dialect)
				require.NoError(t, err)

				// Provide a different name to avoid unique constraint violation
				org.Name = "test org 2"
				return sess.InsertId(&org, dialect)
			},
		},
		{
			desc: "successfully detect unique constrain violations",
			f: func(t *testing.T, sess *sqlstore.DBSession, dialect migrator.Dialect) error {
				// Attempt to insert org with reserved name
				now := time.Now()
				org := org.Org{Name: "test org unique constrain violation", Created: now, Updated: now, ID: 43}
				err := sess.InsertId(&org, dialect)
				require.NoError(t, err)

				// Provide a different ID to avoid primary key violation
				org.ID = 44
				return sess.InsertId(&org, dialect)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			store := sqlstore.NewTestStore(t)
			err := store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
				return tc.f(t, sess, store.GetDialect())
			})
			require.Error(t, err)
			assert.True(t, store.GetDialect().IsUniqueConstraintViolation(err))
		})
	}
}

func TestIntegrationTruncateDatabase(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	migrator := &truncateDatabaseSetup{}
	store := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator), sqlstore.WithTruncation())

	var beans []*truncateBean
	err := store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		return sess.Find(&beans)
	})
	require.NoError(t, err, "could not find truncateBeans")

	require.Empty(t, beans, "database should have no truncateBeans")
}

var (
	_ registry.DatabaseMigrator = (*truncateDatabaseSetup)(nil)
	_ migrator.CodeMigration    = (*truncateDatabaseSetup)(nil)
)

type truncateDatabaseSetup struct {
	migrator.MigrationBase
}

func (t *truncateDatabaseSetup) AddMigration(mg *migrator.Migrator) {
	mg.AddCreateMigration()
	mg.AddMigration("add_to_truncate_table", t)
}

func (*truncateDatabaseSetup) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (t *truncateDatabaseSetup) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	if err := sess.CreateTable(&truncateBean{}); err != nil {
		return err
	}
	_, err := sess.InsertOne(&truncateBean{1234})
	return err
}

type truncateBean struct {
	Value int
}
