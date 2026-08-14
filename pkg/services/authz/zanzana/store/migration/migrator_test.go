package migration

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/openfga/openfga/pkg/storage/migrate"
	"github.com/pressly/goose/v3"
	"github.com/stretchr/testify/require"
)

func TestRunOpenFGAMigrations_ResetsGooseVersionTableOnErrNoNextVersion(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	dbPath := tmpDir + "/openfga-test.db"

	// intentionally corrupt the goose version table
	db, err := goose.OpenDBWithDriver("sqlite3", dbPath)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	_, err = goose.EnsureDBVersion(db)
	require.NoError(t, err)

	_, err = db.Exec("UPDATE goose_db_version SET is_applied = 0")
	require.NoError(t, err)
	_, err = goose.GetDBVersion(db)
	require.ErrorIs(t, err, goose.ErrNoNextVersion)

	cfg := migrate.MigrationConfig{
		Engine: "sqlite",
		URI:    dbPath,
	}
	require.NoError(t, runOpenFGAMigrations(cfg, log.NewNopLogger()))

	// openFGA migrations should have established a valid current version.
	db2, err := goose.OpenDBWithDriver("sqlite3", dbPath)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db2.Close() })
	v, err := goose.GetDBVersion(db2)
	require.NoError(t, err)
	require.GreaterOrEqual(t, v, int64(0))
}

func TestRunOpenFGAMigrations_ResetsSchemaWhenGooseVersionInconsistentButSchemaExists(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	dbPath := tmpDir + "/openfga-test.db"

	cfg := migrate.MigrationConfig{
		Engine: "sqlite",
		URI:    dbPath,
	}
	require.NoError(t, runOpenFGAMigrations(cfg, log.NewNopLogger()))

	db, err := goose.OpenDBWithDriver("sqlite3", dbPath)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	_, err = db.Exec("UPDATE goose_db_version SET is_applied = 0")
	require.NoError(t, err)
	_, err = goose.GetDBVersion(db)
	require.ErrorIs(t, err, goose.ErrNoNextVersion)

	require.NoError(t, runOpenFGAMigrations(cfg, log.NewNopLogger()))

	db2, err := goose.OpenDBWithDriver("sqlite3", dbPath)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db2.Close() })
	_, err = goose.GetDBVersion(db2)
	require.NoError(t, err)
}
