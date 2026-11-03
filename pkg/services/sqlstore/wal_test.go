package sqlstore

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSQLiteJournalMode(t *testing.T) {
	t.Run("wal enabled asks for WAL", func(t *testing.T) {
		dbCfg := sqliteConfig(t, true)
		require.NoError(t, dbCfg.buildConnectionString(&setting.Cfg{}, nil))
		assert.Contains(t, dbCfg.ConnectionString, "_journal_mode=WAL")
	})

	t.Run("wal disabled asks for DELETE", func(t *testing.T) {
		dbCfg := sqliteConfig(t, false)
		require.NoError(t, dbCfg.buildConnectionString(&setting.Cfg{}, nil))
		assert.Contains(t, dbCfg.ConnectionString, "_journal_mode=DELETE")
	})
}

// A database converted to WAL keeps that mode in its file, so disabling the setting
// has to put it back, otherwise there is no way to undo the conversion.
func TestWALDatabaseIsRevertedWhenWALIsDisabled(t *testing.T) {
	path := filepath.Join(t.TempDir(), "grafana.db")

	walCfg := sqliteConfig(t, true)
	walCfg.Path = path
	require.NoError(t, walCfg.buildConnectionString(&setting.Cfg{}, nil))

	walDB, err := sql.Open("sqlite3", walCfg.ConnectionString)
	require.NoError(t, err)
	_, err = walDB.Exec("CREATE TABLE t (a int)")
	require.NoError(t, err)
	_, err = walDB.Exec("INSERT INTO t VALUES (42)")
	require.NoError(t, err)
	require.Equal(t, "wal", journalMode(t, walDB))
	require.NoError(t, walDB.Close())

	offCfg := sqliteConfig(t, false)
	offCfg.Path = path
	require.NoError(t, offCfg.buildConnectionString(&setting.Cfg{}, nil))

	offDB, err := sql.Open("sqlite3", offCfg.ConnectionString)
	require.NoError(t, err)
	defer func() { require.NoError(t, offDB.Close()) }()

	assert.Equal(t, "delete", journalMode(t, offDB))

	var value int
	require.NoError(t, offDB.QueryRow("SELECT a FROM t").Scan(&value))
	assert.Equal(t, 42, value, "reverting the journal mode keeps the data")
}

func sqliteConfig(t *testing.T, walEnabled bool) *DatabaseConfig {
	t.Helper()

	return &DatabaseConfig{
		Type:       migrator.SQLite,
		Path:       filepath.Join(t.TempDir(), "grafana.db"),
		CacheMode:  "private",
		WALEnabled: walEnabled,
	}
}

func journalMode(t *testing.T, db *sql.DB) string {
	t.Helper()

	var mode string
	require.NoError(t, db.QueryRow("PRAGMA journal_mode").Scan(&mode))
	return mode
}
