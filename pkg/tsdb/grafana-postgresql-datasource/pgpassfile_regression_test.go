package postgres

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"

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

// testCACert returns a self-signed CA certificate in PEM form, so that pgx
// accepts sslrootcert while the file still exists.
func testCACert(t *testing.T) []byte {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	tmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "test-ca"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		IsCA:                  true,
		KeyUsage:              x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
	}

	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	require.NoError(t, err)

	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
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

// After the fix: when the data source carries no password of its own,
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

	maybeWirePGPassRefresh(cfg, false)
	require.NotNil(t, cfg.BeforeConnect, "BeforeConnect must be wired when password is empty")

	writePgpass(t, passfile, "B")

	cc, err := pgx.ParseConfig(connStr)
	require.NoError(t, err)
	require.NoError(t, cfg.BeforeConnect(context.Background(), cc))
	require.Equal(t, "B", cc.Password, "BeforeConnect must pull the rotated password from PGPASSFILE")
}

// Grafana writes TLS certificates supplied as file *content* to temporary files
// and deletes them once the pool is set up (see TLSManager.cleanupCertFiles).
// The refresh hook must not depend on anything in the connection string other
// than the password, or it breaks exactly the setup it is meant to fix: a data
// source using PGPASSFILE together with certificate content.
func TestPGPASSFILE_RefreshSurvivesDeletedCertFiles(t *testing.T) {
	dir := t.TempDir()
	passfile := filepath.Join(dir, "pgpass")
	writePgpass(t, passfile, "A")
	t.Setenv("PGPASSFILE", passfile)

	rootCert := filepath.Join(dir, "root.crt")
	require.NoError(t, os.WriteFile(rootCert, testCACert(t), 0o600))

	connStr := "user='u' host='localhost' dbname='db' port=5432 sslmode='verify-ca' sslrootcert='" + rootCert + "'"

	cfg, err := pgxpool.ParseConfig(connStr)
	require.NoError(t, err)
	require.Equal(t, "A", cfg.ConnConfig.Password)

	maybeWirePGPassRefresh(cfg, false)
	require.NotNil(t, cfg.BeforeConnect)

	// Grafana deletes the temporary certificate files right after pool setup,
	// then the credential rotates.
	require.NoError(t, os.Remove(rootCert))
	writePgpass(t, passfile, "B")

	cc := cfg.ConnConfig.Copy()
	require.NoError(t, cfg.BeforeConnect(context.Background(), cc),
		"refresh must not fail once the temporary certificate files are gone")
	require.Equal(t, "B", cc.Password, "rotated password must still be picked up")
}

// When the password is provided inline, no BeforeConnect should be installed —
// the credential is static and re-reading on every connect would be wasted IO.
func TestPGPASSFILE_NoBeforeConnectWhenPasswordInline(t *testing.T) {
	connStr := "user='u' host='localhost' dbname='db' port=5432 password='inline' sslmode='disable'"

	cfg, err := pgxpool.ParseConfig(connStr)
	require.NoError(t, err)

	maybeWirePGPassRefresh(cfg, true)
	require.Nil(t, cfg.BeforeConnect, "BeforeConnect must not be set when password is inline")
}
