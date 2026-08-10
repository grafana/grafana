package sqlstore

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

func TestResolveWAL(t *testing.T) {
	tests := []struct {
		name          string
		setting       walSetting
		fsSupportsWAL bool
		expected      bool
	}{
		{name: "auto enables WAL on a supported filesystem", setting: walAuto, fsSupportsWAL: true, expected: true},
		{name: "auto leaves WAL off on an unsupported filesystem", setting: walAuto, fsSupportsWAL: false, expected: false},
		{name: "true enables WAL on a supported filesystem", setting: walOn, fsSupportsWAL: true, expected: true},
		{name: "true enables WAL even on an unsupported filesystem", setting: walOn, fsSupportsWAL: false, expected: true},
		{name: "false leaves WAL off on a supported filesystem", setting: walOff, fsSupportsWAL: true, expected: false},
		{name: "false leaves WAL off on an unsupported filesystem", setting: walOff, fsSupportsWAL: false, expected: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, resolveWAL(tc.setting, "testfs", tc.fsSupportsWAL))
		})
	}
}

func TestWALFilesystemPath(t *testing.T) {
	t.Run("a database that does not exist yet is judged by its directory", func(t *testing.T) {
		dir := t.TempDir()
		assert.Equal(t, dir, walFilesystemPath(filepath.Join(dir, "grafana.db")))
	})

	t.Run("an existing database is inspected directly", func(t *testing.T) {
		dir := t.TempDir()
		path := filepath.Join(dir, "grafana.db")
		require.NoError(t, os.WriteFile(path, nil, 0o600))
		assert.Equal(t, path, walFilesystemPath(path))
	})

	t.Run("a symlink to a database that does not exist yet is judged by its target", func(t *testing.T) {
		dir := t.TempDir()
		target := filepath.Join(dir, "elsewhere", "grafana.db")
		require.NoError(t, os.MkdirAll(filepath.Dir(target), 0o750))
		link := filepath.Join(dir, "grafana.db")
		require.NoError(t, os.Symlink(target, link))

		assert.Equal(t, filepath.Dir(target), walFilesystemPath(link))
	})

	t.Run("relative symlinks resolve against the link directory", func(t *testing.T) {
		dir := t.TempDir()
		require.NoError(t, os.MkdirAll(filepath.Join(dir, "elsewhere"), 0o750))
		link := filepath.Join(dir, "grafana.db")
		require.NoError(t, os.Symlink(filepath.Join("elsewhere", "grafana.db"), link))

		assert.Equal(t, filepath.Join(dir, "elsewhere"), walFilesystemPath(link))
	})

}

func TestFilesystemSupportsWAL(t *testing.T) {
	// The result depends on the filesystem the tests run on, so only check that the
	// filesystem is always named, since the name ends up in a log line.
	name, _ := filesystemSupportsWAL(t.TempDir())
	assert.NotEmpty(t, name)
}

// A database converted to WAL keeps that mode in its file, so it has to be reverted
// when it ends up somewhere WAL does not work, for example after a move to a network
// mount.
func TestWALDatabaseIsRevertedWhenWALIsOff(t *testing.T) {
	path := filepath.Join(t.TempDir(), "grafana.db")

	walCfg := &DatabaseConfig{Type: migrator.SQLite, Path: path, CacheMode: "private", wal: walOn}
	require.NoError(t, walCfg.buildConnectionString(&setting.Cfg{}, nil))

	walDB, err := sql.Open("sqlite3", walCfg.ConnectionString)
	require.NoError(t, err)
	_, err = walDB.Exec("CREATE TABLE t (a int)")
	require.NoError(t, err)
	_, err = walDB.Exec("INSERT INTO t VALUES (42)")
	require.NoError(t, err)
	require.Equal(t, "wal", journalMode(t, walDB))
	require.NoError(t, walDB.Close())

	offCfg := &DatabaseConfig{Type: migrator.SQLite, Path: path, CacheMode: "private", wal: walOff}
	require.NoError(t, offCfg.buildConnectionString(&setting.Cfg{}, nil))

	offDB, err := sql.Open("sqlite3", offCfg.ConnectionString)
	require.NoError(t, err)
	defer func() { require.NoError(t, offDB.Close()) }()

	assert.Equal(t, "delete", journalMode(t, offDB))

	var value int
	require.NoError(t, offDB.QueryRow("SELECT a FROM t").Scan(&value))
	assert.Equal(t, 42, value, "reverting the journal mode keeps the data")
}

func journalMode(t *testing.T, db *sql.DB) string {
	t.Helper()

	var mode string
	require.NoError(t, db.QueryRow("PRAGMA journal_mode").Scan(&mode))
	return mode
}
