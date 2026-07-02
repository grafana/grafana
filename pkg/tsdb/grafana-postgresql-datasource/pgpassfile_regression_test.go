package postgres

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

// Hypothesis for grafana/grafana#123617:
//   - pgconn.ParseConfig reads PGPASSFILE on every call (re-read works at parse time).
//   - pgxpool keeps a single ConnConfig snapshot. Without BeforeConnect, the
//     password captured at ParseConfig time is reused for the lifetime of the pool.
//   - Current postgres.go does not set BeforeConnect, so rotated PGPASSFILE
//     credentials are never picked up.

func writePgpass(t *testing.T, path, password string) {
	t.Helper()
	// host:port:database:user:password
	line := "localhost:5432:db:u:" + password + "\n"
	require.NoError(t, os.WriteFile(path, []byte(line), 0o600))
}

func TestPGPASSFILE_ParseConfigReReadsFile(t *testing.T) {
	dir := t.TempDir()
	passfile := filepath.Join(dir, "pgpass")
	writePgpass(t, passfile, "A")
	t.Setenv("PGPASSFILE", passfile)

	connStr := "host=localhost port=5432 user=u dbname=db"

	cfgA, err := pgxpool.ParseConfig(connStr)
	require.NoError(t, err)
	require.Equal(t, "A", cfgA.ConnConfig.Password, "first parse should pick up password from PGPASSFILE")

	writePgpass(t, passfile, "B")

	cfgB, err := pgxpool.ParseConfig(connStr)
	require.NoError(t, err)
	require.Equal(t, "B", cfgB.ConnConfig.Password, "second parse should re-read PGPASSFILE")
}

func TestPGPASSFILE_PoolConfigDoesNotAutoRefresh(t *testing.T) {
	dir := t.TempDir()
	passfile := filepath.Join(dir, "pgpass")
	writePgpass(t, passfile, "A")
	t.Setenv("PGPASSFILE", passfile)

	connStr := "host=localhost port=5432 user=u dbname=db"

	cfg, err := pgxpool.ParseConfig(connStr)
	require.NoError(t, err)
	require.Equal(t, "A", cfg.ConnConfig.Password)

	writePgpass(t, passfile, "B")

	// Pool keeps the snapshot. No automatic reload.
	require.Equal(t, "A", cfg.ConnConfig.Password,
		"pgxpool.Config caches ConnConfig — password is not refreshed when PGPASSFILE changes")
}

// After the fix: when the connection string carries no password,
// maybeWirePGPassRefresh installs a BeforeConnect hook that re-resolves the
// password from PGPASSFILE for every new connection.
func TestPGPASSFILE_BeforeConnectRefreshesPassword(t *testing.T) {
	dir := t.TempDir()
	passfile := filepath.Join(dir, "pgpass")
	writePgpass(t, passfile, "A")
	t.Setenv("PGPASSFILE", passfile)

	connStr := "user='u' host='localhost' dbname='db' port=5432 sslmode='disable'"

	cfg, err := pgxpool.ParseConfig(connStr)
	require.NoError(t, err)
	require.Equal(t, "A", cfg.ConnConfig.Password)

	maybeWirePGPassRefresh(cfg, connStr)
	require.NotNil(t, cfg.BeforeConnect, "BeforeConnect must be wired when password is empty")

	writePgpass(t, passfile, "B")

	cc, err := pgx.ParseConfig(connStr)
	require.NoError(t, err)
	require.NoError(t, cfg.BeforeConnect(context.Background(), cc))
	require.Equal(t, "B", cc.Password, "BeforeConnect must pull the rotated password from PGPASSFILE")
}

// When the password is provided inline, no BeforeConnect should be installed —
// the credential is static and re-parsing on every connect would be wasted IO.
func TestPGPASSFILE_NoBeforeConnectWhenPasswordInline(t *testing.T) {
	connStr := "user='u' host='localhost' dbname='db' port=5432 password='inline' sslmode='disable'"

	cfg, err := pgxpool.ParseConfig(connStr)
	require.NoError(t, err)

	maybeWirePGPassRefresh(cfg, connStr)
	require.Nil(t, cfg.BeforeConnect, "BeforeConnect must not be set when password is inline")
}
