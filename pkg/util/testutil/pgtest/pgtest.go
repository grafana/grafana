// Package pgtest provides helpers for integration tests that run against a real PostgreSQL database.
//
// To run such a test against a local Postgres manually, make sure the Docker daemon is running,
// the Postgres test container is up and run the test with `GRAFANA_TEST_DB=postgres`.
// For example,
// ```
//
//	# Make sure the Docker daemon is running
//	open -a Docker
//	# Bring up the Postgres test container
//	make devenv sources=postgres_tests
//	# Run test
//	GRAFANA_TEST_DB=postgres go test -count=1 -v -run TestIntegrationTagsHandler ./pkg/registry/apps/annotation/
//	# Tear down container
//	make devenv-down sources=postgres_tests
//
// ```
package pgtest

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/testutil"
)

// NewDatabase provisions an isolated PostgreSQL database for an integration test and returns a DSN pointing at it.
// Each call creates a brand-new, uniquely-named database so tests never share state.
func NewDatabase(t testing.TB) string {
	t.Helper()
	testutil.SkipIntegrationTestInShortMode(t)
	if os.Getenv("GRAFANA_TEST_DB") != "postgres" {
		t.Skip("postgres integration test requires GRAFANA_TEST_DB=postgres")
	}

	name := uniqueDBName(t)
	quotedName := pgx.Identifier{name}.Sanitize()
	adminDSN := dsn(envOrDefault("POSTGRES_DB", "grafanatest"))

	createDatabase(t, adminDSN, quotedName)

	t.Cleanup(func() { dropDatabase(t, adminDSN, quotedName) })

	return dsn(name)
}

// createDatabase creates a database via a maintenance connection.
func createDatabase(t testing.TB, adminDSN, quotedName string) {
	t.Helper()
	ctx := context.Background()
	admin, err := pgx.Connect(ctx, adminDSN)
	require.NoError(t, err, "connect to postgres to create test database")
	defer func() { _ = admin.Close(ctx) }()

	// quotedName is sanitized via pgx.Identifier.Sanitize(), which double-quotes and
	// escapes the identifier per PostgreSQL rules. Parameterized queries ($1) cannot
	// be used for DDL identifiers, so pre-sanitized identifier interpolation is the
	// correct and safe approach here.
	_, err = admin.Exec(ctx, fmt.Sprintf("CREATE DATABASE %s", quotedName)) // nosemgrep: pgx-sqli
	require.NoError(t, err, "create test database %q", quotedName)
}

// dropDatabase drops the database with the supplied name via a maintenance connection.
func dropDatabase(t testing.TB, adminDSN, quotedName string) {
	t.Helper()
	ctx := context.Background()
	admin, err := pgx.Connect(ctx, adminDSN)
	if err != nil {
		t.Logf("pgtest: connect to drop test database %q: %v", quotedName, err)
		return
	}
	defer func() { _ = admin.Close(ctx) }()

	// WITH (FORCE) terminates any lingering connections (Postgres 13+).
	// quotedName is sanitized via pgx.Identifier.Sanitize(); DDL identifiers cannot
	// use parameterized queries, so pre-sanitized identifier interpolation is safe here.
	if _, err := admin.Exec(ctx, fmt.Sprintf("DROP DATABASE IF EXISTS %s WITH (FORCE)", quotedName)); err != nil { // nosemgrep: pgx-sqli
		t.Logf("pgtest: drop test database %q: %v", quotedName, err)
	}
}

// dsn builds a connection string.
func dsn(database string) string {
	return fmt.Sprintf("user=%s password=%s host=%s port=%s dbname=%s sslmode=%s",
		envOrDefault("POSTGRES_USER", "grafanatest"),
		envOrDefault("POSTGRES_PASSWORD", "grafanatest"),
		envOrDefault("POSTGRES_HOST", "localhost"),
		envOrDefault("POSTGRES_PORT", "5432"),
		database,
		envOrDefault("POSTGRES_SSL", "disable"),
	)
}

// uniqueDBName generates a random, unique database name prefixed with "pgtest_" for test isolation.
func uniqueDBName(t testing.TB) string {
	t.Helper()
	b := make([]byte, 9) // 18 hex chars
	_, err := rand.Read(b)
	require.NoError(t, err)
	return "pgtest_" + hex.EncodeToString(b)
}

func envOrDefault(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}
