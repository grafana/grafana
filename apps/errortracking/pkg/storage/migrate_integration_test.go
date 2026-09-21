package storage

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestMigratePostgreSQL(t *testing.T) {
	if os.Getenv("ERROR_TRACKING_MIGRATION_TEST") != "1" {
		t.Skip("set ERROR_TRACKING_MIGRATION_TEST=1 for a disposable PostgreSQL database")
	}
	connectionString := os.Getenv("ERROR_TRACKING_MIGRATION_TEST_DATABASE_URL")
	ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
	defer cancel()

	admin, err := pgx.Connect(ctx, connectionString)
	if err != nil {
		t.Fatal("connect to disposable PostgreSQL database")
	}
	t.Cleanup(func() { _ = admin.Close(context.WithoutCancel(ctx)) })

	var database string
	var eventTableExists bool
	if err := admin.QueryRow(ctx, `SELECT current_database(), to_regclass('public.error_tracking_event') IS NOT NULL`).Scan(&database, &eventTableExists); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(database, "error_tracking_migration_test") || eventTableExists {
		t.Fatalf("integration test requires an empty disposable database named error_tracking_migration_test*, got %q", database)
	}

	suffix := time.Now().UnixNano()
	runtimeRole := fmt.Sprintf("error_tracking_runtime_%d", suffix)
	parentRole := fmt.Sprintf("error_tracking_parent_%d", suffix)
	runtimeIdentifier := pgx.Identifier{runtimeRole}.Sanitize()
	parentIdentifier := pgx.Identifier{parentRole}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE ROLE "+runtimeIdentifier+" LOGIN"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = admin.Exec(context.WithoutCancel(ctx), "DROP OWNED BY "+runtimeIdentifier)
		_, _ = admin.Exec(context.WithoutCancel(ctx), "DROP ROLE IF EXISTS "+parentIdentifier)
		_, _ = admin.Exec(context.WithoutCancel(ctx), "DROP ROLE IF EXISTS "+runtimeIdentifier)
	})

	if err := Migrate(ctx, connectionString, runtimeRole); err != nil {
		t.Fatalf("first migration: %v", err)
	}
	if err := Migrate(ctx, connectionString, runtimeRole); err != nil {
		t.Fatalf("idempotent migration: %v", err)
	}

	assertRuntimePrivileges(t, ctx, admin, runtimeIdentifier)

	if _, err := admin.Exec(ctx, `INSERT INTO error_tracking_schema_migration(version, hash) VALUES ($1, 'future')`, CurrentSchemaVersion+1); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, connectionString, runtimeRole); err == nil || !strings.Contains(err.Error(), "newer than this executable") {
		t.Fatalf("future migration ledger was not rejected: %v", err)
	}
	if _, err := admin.Exec(ctx, `DELETE FROM error_tracking_schema_migration WHERE version = $1`, CurrentSchemaVersion+1); err != nil {
		t.Fatal(err)
	}

	if _, err := admin.Exec(ctx, `GRANT CREATE ON SCHEMA public TO PUBLIC`); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, connectionString, runtimeRole); err == nil || !strings.Contains(err.Error(), "privileges outside") {
		t.Fatalf("PUBLIC schema CREATE was not rejected: %v", err)
	}
	if _, err := admin.Exec(ctx, `REVOKE CREATE ON SCHEMA public FROM PUBLIC`); err != nil {
		t.Fatal(err)
	}

	var schemaOwner string
	if err := admin.QueryRow(ctx, `SELECT owner.rolname FROM pg_namespace namespace JOIN pg_roles owner ON owner.oid = namespace.nspowner WHERE namespace.nspname = 'public'`).Scan(&schemaOwner); err != nil {
		t.Fatal(err)
	}
	if _, err := admin.Exec(ctx, "ALTER SCHEMA public OWNER TO "+runtimeIdentifier); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, connectionString, runtimeRole); err == nil || !strings.Contains(err.Error(), "must not own") {
		t.Fatalf("runtime schema ownership was not rejected: %v", err)
	}
	if _, err := admin.Exec(ctx, "ALTER SCHEMA public OWNER TO "+pgx.Identifier{schemaOwner}.Sanitize()); err != nil {
		t.Fatal(err)
	}

	if _, err := admin.Exec(ctx, "CREATE ROLE "+parentIdentifier); err != nil {
		t.Fatal(err)
	}
	if _, err := admin.Exec(ctx, "GRANT "+parentIdentifier+" TO "+runtimeIdentifier); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, connectionString, runtimeRole); err == nil || !strings.Contains(err.Error(), "inherits another role") {
		t.Fatalf("runtime role membership was not rejected: %v", err)
	}
	if _, err := admin.Exec(ctx, "REVOKE "+parentIdentifier+" FROM "+runtimeIdentifier); err != nil {
		t.Fatal(err)
	}
}

func assertRuntimePrivileges(t *testing.T, ctx context.Context, admin *pgx.Conn, runtimeRole string) {
	t.Helper()
	if _, err := admin.Exec(ctx, "SET ROLE "+runtimeRole); err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = admin.Exec(context.WithoutCancel(ctx), "RESET ROLE") }()

	allowed := []string{
		`SELECT count(*) FROM error_tracking_schema_migration`,
		`INSERT INTO error_tracking_event (created_at, occurred_at, tenant_namespace, project, message, created_by, source_ip) VALUES (0, 0, 'test', 'test', 'test', 'test', 'test')`,
	}
	for _, statement := range allowed {
		if _, err := admin.Exec(ctx, statement); err != nil {
			t.Fatalf("required runtime privilege missing: %v", err)
		}
	}
	denied := []string{
		`UPDATE error_tracking_event SET message = 'forbidden' WHERE false`,
		`DELETE FROM error_tracking_event WHERE false`,
		`TRUNCATE error_tracking_event`,
		`CREATE TABLE forbidden_runtime_table (id integer)`,
		`CREATE TEMP TABLE forbidden_runtime_temp_table (id integer)`,
		`INSERT INTO error_tracking_schema_migration(version, hash) VALUES (999, 'forbidden')`,
		`SELECT setval('error_tracking_event_id_seq', 1, false)`,
	}
	for _, statement := range denied {
		_, err := admin.Exec(ctx, statement)
		var postgresError *pgconn.PgError
		if !errors.As(err, &postgresError) || postgresError.Code != "42501" {
			t.Fatalf("expected permission denial for %q, got %v", statement, err)
		}
	}
}
