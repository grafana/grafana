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

	assertSchemaInvariants(t, ctx, admin)
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
		`INSERT INTO projects (tenant_namespace, name, ingest_key) VALUES ('stacks-1', 'runtime-test', 'a1b2c3d4e5f60718293a4b5c6d7e8f90')`,
		`INSERT INTO environments (project_id, name) SELECT id, '' FROM projects WHERE name = 'runtime-test'`,
		`INSERT INTO errors (project_id, fingerprint, first_seen, last_seen) SELECT id, 'fp-runtime', now(), now() FROM projects WHERE name = 'runtime-test'`,
		`UPDATE errors SET event_count = event_count + 1, last_seen = now() WHERE fingerprint = 'fp-runtime'`,
		`INSERT INTO events (error_id, environment_id, event_id, occurred_at, payload)
			SELECT e.id, env.id, 'evt-runtime', now(), '{}' FROM errors e JOIN environments env ON env.project_id = e.project_id WHERE e.fingerprint = 'fp-runtime'`,
		`INSERT INTO error_status_changes (error_id, from_status, to_status, actor)
			SELECT id, NULL::error_status, 'unresolved'::error_status, 'system:ingest' FROM errors WHERE fingerprint = 'fp-runtime'`,
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
		`UPDATE projects SET name = 'forbidden' WHERE false`,
		`UPDATE environments SET name = 'forbidden' WHERE false`,
		`UPDATE events SET release = 'forbidden' WHERE false`,
		`UPDATE error_status_changes SET actor = 'forbidden' WHERE false`,
		`DELETE FROM errors WHERE false`,
		`TRUNCATE errors`,
		`CREATE TABLE forbidden_runtime_table (id integer)`,
		`CREATE TEMP TABLE forbidden_runtime_temp_table (id integer)`,
		`INSERT INTO error_tracking_schema_migration(version, hash) VALUES (999, 'forbidden')`,
		`SELECT setval('error_tracking_event_id_seq', 1, false)`,
		`SELECT setval('errors_id_seq', 1, false)`,
	}
	for _, statement := range denied {
		_, err := admin.Exec(ctx, statement)
		var postgresError *pgconn.PgError
		if !errors.As(err, &postgresError) || postgresError.Code != "42501" {
			t.Fatalf("expected permission denial for %q, got %v", statement, err)
		}
	}
}

// assertSchemaInvariants checks that the constraints the status machine relies on are enforced by the
// database, so a handler that forgets a column fails loudly instead of leaving an inconsistent row.
func assertSchemaInvariants(t *testing.T, ctx context.Context, admin *pgx.Conn) {
	t.Helper()
	var projectID, errorID, environmentID int64
	if err := admin.QueryRow(ctx, `INSERT INTO projects (tenant_namespace, name, ingest_key)
		VALUES ('stacks-1', 'invariants', '0123456789abcdef0123456789abcdef') RETURNING id`).Scan(&projectID); err != nil {
		t.Fatal(err)
	}
	if err := admin.QueryRow(ctx, `INSERT INTO environments (project_id, name) VALUES ($1, '') RETURNING id`, projectID).Scan(&environmentID); err != nil {
		t.Fatal(err)
	}
	if err := admin.QueryRow(ctx, `INSERT INTO errors (project_id, fingerprint, first_seen, last_seen)
		VALUES ($1, 'fp-ok', now(), now()) RETURNING id`, projectID).Scan(&errorID); err != nil {
		t.Fatal(err)
	}
	if _, err := admin.Exec(ctx, `INSERT INTO events (error_id, environment_id, event_id, occurred_at, payload)
		VALUES ($1, $2, 'evt-1', now(), '{}')`, errorID, environmentID); err != nil {
		t.Fatal(err)
	}

	const uniqueViolation, checkViolation = "23505", "23514"
	rejected := []struct {
		name      string
		statement string
		code      string
		args      []any
	}{
		{"ingest key must be 32 hex characters", `INSERT INTO projects (tenant_namespace, name, ingest_key) VALUES ('stacks-1', 'bad-key', 'not-hex')`, checkViolation, nil},
		{"one project name per tenant", `INSERT INTO projects (tenant_namespace, name, ingest_key) VALUES ('stacks-1', 'invariants', 'ffffffffffffffffffffffffffffffff')`, uniqueViolation, nil},
		{"one error per project and fingerprint", `INSERT INTO errors (project_id, fingerprint, first_seen, last_seen) VALUES ($1, 'fp-ok', now(), now())`, uniqueViolation, []any{projectID}},
		{"a resent event is a no-op, not a second row", `INSERT INTO events (error_id, environment_id, event_id, occurred_at, payload) VALUES ($1, $2, 'evt-1', now(), '{}')`, uniqueViolation, []any{errorID, environmentID}},
		{"ignored needs a clearing condition", `UPDATE errors SET status = 'ignored' WHERE id = $1`, checkViolation, []any{errorID}},
		{"clearing conditions only while ignored", `UPDATE errors SET ignored_until_events = 10 WHERE id = $1`, checkViolation, []any{errorID}},
		{"regressed only while unresolved", `UPDATE errors SET status = 'resolved', regressed = true WHERE id = $1`, checkViolation, []any{errorID}},
		{"a status change needs an actor", `INSERT INTO error_status_changes (error_id, from_status, to_status, actor) VALUES ($1, NULL, 'unresolved', '')`, checkViolation, []any{errorID}},
		{"a status change must change the status", `INSERT INTO error_status_changes (error_id, from_status, to_status, actor) VALUES ($1, 'unresolved', 'unresolved', 'test')`, checkViolation, []any{errorID}},
	}
	for _, c := range rejected {
		_, err := admin.Exec(ctx, c.statement, c.args...)
		var postgresError *pgconn.PgError
		if !errors.As(err, &postgresError) || postgresError.Code != c.code {
			t.Fatalf("%s: expected SQLSTATE %s, got %v", c.name, c.code, err)
		}
	}

	accepted := []struct {
		statement string
		args      []any
	}{
		{`UPDATE errors SET status = 'ignored', ignored_until_events = 10, snapshot_release = 'v1' WHERE id = $1`, []any{errorID}},
		{`INSERT INTO error_status_changes (error_id, from_status, to_status, actor) VALUES ($1, 'unresolved', 'ignored', 'user:1')`, []any{errorID}},
		{`UPDATE errors SET status = 'unresolved', regressed = true, ignored_until_events = NULL WHERE id = $1`, []any{errorID}},
		{`INSERT INTO error_status_changes (error_id, from_status, to_status, actor) VALUES ($1, NULL, 'unresolved', 'system:ingest')`, []any{errorID}},
	}
	for _, c := range accepted {
		if _, err := admin.Exec(ctx, c.statement, c.args...); err != nil {
			t.Fatalf("valid transition rejected: %q: %v", c.statement, err)
		}
	}
}
