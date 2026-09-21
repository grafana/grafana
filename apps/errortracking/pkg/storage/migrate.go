package storage

import (
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const CurrentSchemaVersion = 2

//go:embed schema.sql
var schemaSQL string

var roleNamePattern = regexp.MustCompile(`^[a-z_][a-z0-9_]*$`)

// insertOnlyTables are read and appended to by the runtime, never rewritten. errors is the
// exception: counters and the status machine are updated in place, so it is granted separately.
var insertOnlyTables = []string{"error_tracking_event", "projects", "environments", "events", "error_status_changes"}

var appSequences = []string{
	"error_tracking_event_id_seq", "projects_id_seq", "environments_id_seq",
	"errors_id_seq", "events_id_seq", "error_status_changes_id_seq",
}

type expectedColumn struct {
	dataType string
	nullable bool
}

// expectedColumns is the shape of every app-owned table. schema.sql uses CREATE TABLE IF NOT EXISTS,
// which would silently adopt a foreign table of the same name, so migrate refuses to run when an
// existing table does not match.
var expectedColumns = map[string]map[string]expectedColumn{
	"error_tracking_event": {
		"id": {"bigint", false}, "created_at": {"bigint", false}, "occurred_at": {"bigint", false},
		"tenant_namespace": {"character varying", false}, "project": {"character varying", false},
		"message": {"text", false}, "created_by": {"character varying", false}, "source_ip": {"character varying", false},
	},
	"projects": {
		"id": {"bigint", false}, "tenant_namespace": {"text", false}, "name": {"text", false},
		"description": {"text", false}, "ingest_key": {"text", false}, "created_at": {"timestamp with time zone", false},
	},
	"environments": {
		"id": {"bigint", false}, "project_id": {"bigint", false}, "name": {"text", false},
		"created_at": {"timestamp with time zone", false},
	},
	"errors": {
		"id": {"bigint", false}, "project_id": {"bigint", false}, "fingerprint": {"text", false},
		"status": {"USER-DEFINED", false}, "exception_type": {"text", false}, "message": {"text", false},
		"culprit": {"text", false}, "event_count": {"bigint", false},
		"first_seen": {"timestamp with time zone", false}, "last_seen": {"timestamp with time zone", false},
		"regressed": {"boolean", false}, "snapshot_release": {"text", false},
		"ignored_until_at": {"timestamp with time zone", true}, "ignored_until_events": {"bigint", true},
	},
	"events": {
		"id": {"bigint", false}, "error_id": {"bigint", false}, "environment_id": {"bigint", false},
		"event_id": {"text", false}, "occurred_at": {"timestamp with time zone", false},
		"release": {"text", false}, "payload": {"jsonb", false},
	},
	"error_status_changes": {
		"id": {"bigint", false}, "error_id": {"bigint", false}, "from_status": {"USER-DEFINED", true},
		"to_status": {"USER-DEFINED", false}, "actor": {"text", false}, "created_at": {"timestamp with time zone", false},
	},
}

func SchemaHash() string {
	sum := sha256.Sum256([]byte(schemaSQL))
	return hex.EncodeToString(sum[:])
}

// Migrate applies the app-owned schema and grants the existing runtime role only
// the privileges needed by Store. The caller must use migration-owner credentials.
func Migrate(ctx context.Context, connectionString, runtimeRole string) error {
	if !roleNamePattern.MatchString(runtimeRole) {
		return fmt.Errorf("error tracking runtime role must be a PostgreSQL identifier")
	}
	conn, err := pgx.Connect(ctx, connectionString)
	if err != nil {
		return databaseFailure(ctx, "connect for migration", err)
	}
	defer func() { _ = conn.Close(context.WithoutCancel(ctx)) }()

	tx, err := conn.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return databaseFailure(ctx, "begin migration", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('grafana-error-tracking-schema'))`); err != nil {
		return databaseFailure(ctx, "lock migration", err)
	}
	if err := validateRuntimeRole(ctx, tx, runtimeRole); err != nil {
		return err
	}
	if err := validateExistingSchema(ctx, tx); err != nil {
		return err
	}
	if err := validateMigrationLedger(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, schemaSQL, pgx.QueryExecModeSimpleProtocol); err != nil {
		return databaseFailure(ctx, "apply schema", err)
	}

	hash := SchemaHash()
	var recordedHash string
	err = tx.QueryRow(ctx, `SELECT hash FROM error_tracking_schema_migration WHERE version = $1`, CurrentSchemaVersion).Scan(&recordedHash)
	switch {
	case err == nil && recordedHash != hash:
		return fmt.Errorf("error tracking schema migration hash does not match the executable")
	case err == nil:
	case errors.Is(err, pgx.ErrNoRows):
		if _, err := tx.Exec(ctx, `INSERT INTO error_tracking_schema_migration (version, hash) VALUES ($1, $2)`, CurrentSchemaVersion, hash); err != nil {
			return databaseFailure(ctx, "record migration", err)
		}
	default:
		return databaseFailure(ctx, "read migration ledger", err)
	}

	if err := applyRuntimeGrants(ctx, tx, runtimeRole); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return databaseFailure(ctx, "commit migration", err)
	}
	return nil
}

func validateMigrationLedger(ctx context.Context, tx pgx.Tx) error {
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT to_regclass('public.error_tracking_schema_migration') IS NOT NULL`).Scan(&exists); err != nil {
		return databaseFailure(ctx, "inspect migration ledger", err)
	}
	if !exists {
		return nil
	}
	var latest int
	if err := tx.QueryRow(ctx, `SELECT COALESCE(MAX(version), 0) FROM error_tracking_schema_migration`).Scan(&latest); err != nil {
		return databaseFailure(ctx, "inspect migration ledger", err)
	}
	if latest > CurrentSchemaVersion {
		return fmt.Errorf("error tracking database schema is newer than this executable")
	}
	return nil
}

func validateExistingSchema(ctx context.Context, tx pgx.Tx) error {
	for table, want := range expectedColumns {
		if err := validateExistingTable(ctx, tx, table, want); err != nil {
			return err
		}
	}
	return nil
}

func validateExistingTable(ctx context.Context, tx pgx.Tx, table string, want map[string]expectedColumn) error {
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT to_regclass('public.' || $1) IS NOT NULL`, table).Scan(&exists); err != nil {
		return databaseFailure(ctx, "inspect schema", err)
	}
	if !exists {
		return nil
	}

	rows, err := tx.Query(ctx, `SELECT column_name, data_type, is_nullable
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = $1`, table)
	if err != nil {
		return databaseFailure(ctx, "inspect existing table", err)
	}
	defer rows.Close()

	seen := make(map[string]bool, len(want))
	for rows.Next() {
		var name, dataType, nullable string
		if err := rows.Scan(&name, &dataType, &nullable); err != nil {
			return databaseFailure(ctx, "inspect existing table", err)
		}
		expected, ok := want[name]
		if !ok || expected.dataType != dataType || expected.nullable != (nullable == "YES") {
			return fmt.Errorf("existing error tracking table %s does not match the app-owned schema", table)
		}
		seen[name] = true
	}
	if err := rows.Err(); err != nil {
		return databaseFailure(ctx, "inspect existing table", err)
	}
	if len(seen) != len(want) {
		return fmt.Errorf("existing error tracking table %s does not match the app-owned schema", table)
	}
	return nil
}

func validateRuntimeRole(ctx context.Context, tx pgx.Tx, runtimeRole string) error {
	var currentUser string
	if err := tx.QueryRow(ctx, `SELECT current_user`).Scan(&currentUser); err != nil {
		return databaseFailure(ctx, "read migration identity", err)
	}
	if currentUser == runtimeRole {
		return fmt.Errorf("migration owner and runtime role must be different")
	}

	var canLogin, superuser, createRole, createDB, replication, bypassRLS, inheritedRole bool
	err := tx.QueryRow(ctx, `SELECT role.rolcanlogin, role.rolsuper, role.rolcreaterole, role.rolcreatedb,
		role.rolreplication, role.rolbypassrls,
		EXISTS (
			SELECT 1 FROM pg_auth_members membership WHERE membership.member = role.oid
		)
		FROM pg_roles role WHERE role.rolname = $1`, runtimeRole).
		Scan(&canLogin, &superuser, &createRole, &createDB, &replication, &bypassRLS, &inheritedRole)
	if errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("error tracking runtime role does not exist")
	}
	if err != nil {
		return databaseFailure(ctx, "validate runtime role", err)
	}
	if !canLogin || superuser || createRole || createDB || replication || bypassRLS || inheritedRole {
		return fmt.Errorf("error tracking runtime role is missing LOGIN, inherits another role, or has privileged capabilities")
	}
	var ownsDatabaseOrSchema bool
	if err := tx.QueryRow(ctx, `SELECT
		EXISTS (SELECT 1 FROM pg_database database JOIN pg_roles owner ON owner.oid = database.datdba
			WHERE database.datname = current_database() AND owner.rolname = $1)
		OR EXISTS (SELECT 1 FROM pg_namespace namespace JOIN pg_roles owner ON owner.oid = namespace.nspowner
			WHERE namespace.nspname = 'public' AND owner.rolname = $1)`, runtimeRole).Scan(&ownsDatabaseOrSchema); err != nil {
		return databaseFailure(ctx, "validate runtime ownership", err)
	}
	if ownsDatabaseOrSchema {
		return fmt.Errorf("error tracking runtime role must not own the database or public schema")
	}

	relations := append([]string{"error_tracking_schema_migration", "errors"}, insertOnlyTables...)
	relations = append(relations, appSequences...)
	var ownsObjects bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
		JOIN pg_roles owner ON owner.oid = c.relowner
		WHERE n.nspname = 'public' AND c.relname = ANY($2::text[])
		  AND owner.rolname = $1
	)`, runtimeRole, relations).Scan(&ownsObjects); err != nil {
		return databaseFailure(ctx, "validate runtime ownership", err)
	}
	if ownsObjects {
		return fmt.Errorf("error tracking runtime role must not own app schema objects")
	}
	return nil
}

func applyRuntimeGrants(ctx context.Context, tx pgx.Tx, runtimeRole string) error {
	role := pgx.Identifier{runtimeRole}.Sanitize()
	var database string
	if err := tx.QueryRow(ctx, `SELECT current_database()`).Scan(&database); err != nil {
		return databaseFailure(ctx, "read database name", err)
	}
	databaseName := pgx.Identifier{database}.Sanitize()
	insertOnly := strings.Join(insertOnlyTables, ", ")
	sequences := strings.Join(appSequences, ", ")
	statements := []string{
		"REVOKE ALL PRIVILEGES ON DATABASE " + databaseName + " FROM " + role,
		"REVOKE TEMPORARY ON DATABASE " + databaseName + " FROM PUBLIC, " + role,
		"GRANT CONNECT ON DATABASE " + databaseName + " TO " + role,
		"REVOKE ALL PRIVILEGES ON SCHEMA public FROM " + role,
		"GRANT USAGE ON SCHEMA public TO " + role,
		"REVOKE ALL PRIVILEGES ON TABLE error_tracking_schema_migration, errors, " + insertOnly + " FROM " + role,
		"GRANT SELECT ON TABLE error_tracking_schema_migration TO " + role,
		"GRANT SELECT, INSERT ON TABLE " + insertOnly + " TO " + role,
		"GRANT SELECT, INSERT, UPDATE ON TABLE errors TO " + role,
		"REVOKE ALL PRIVILEGES ON SEQUENCE " + sequences + " FROM " + role,
		"GRANT USAGE, SELECT ON SEQUENCE " + sequences + " TO " + role,
	}
	for _, statement := range statements {
		if _, err := tx.Exec(ctx, statement); err != nil {
			return databaseFailure(ctx, "grant runtime privileges", err)
		}
	}
	var restricted bool
	if err := tx.QueryRow(ctx, `SELECT
		has_database_privilege($1, current_database(), 'CONNECT')
		AND NOT has_database_privilege($1, current_database(), 'CREATE')
		AND NOT has_database_privilege($1, current_database(), 'TEMPORARY')
		AND NOT has_schema_privilege($1, 'public', 'CREATE')
		AND has_schema_privilege($1, 'public', 'USAGE')
		AND has_table_privilege($1, 'error_tracking_schema_migration', 'SELECT')
		AND NOT has_table_privilege($1, 'error_tracking_schema_migration', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
		AND has_table_privilege($1, 'errors', 'SELECT')
		AND has_table_privilege($1, 'errors', 'INSERT')
		AND has_table_privilege($1, 'errors', 'UPDATE')
		AND NOT has_table_privilege($1, 'errors', 'DELETE,TRUNCATE,REFERENCES,TRIGGER')
		AND (SELECT bool_and(has_table_privilege($1, t, 'SELECT')
			AND has_table_privilege($1, t, 'INSERT')
			AND NOT has_table_privilege($1, t, 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
			FROM unnest($2::text[]) AS t)
		AND (SELECT bool_and(has_sequence_privilege($1, s, 'USAGE')
			AND has_sequence_privilege($1, s, 'SELECT')
			AND NOT has_sequence_privilege($1, s, 'UPDATE'))
			FROM unnest($3::text[]) AS s)`, runtimeRole, insertOnlyTables, appSequences).Scan(&restricted); err != nil {
		return databaseFailure(ctx, "verify runtime privileges", err)
	}
	if !restricted {
		return fmt.Errorf("error tracking runtime role has privileges outside the required runtime set")
	}
	return nil
}

func requireCurrentMigration(ctx context.Context, pool *pgxpool.Pool) error {
	var version int
	var hash string
	if err := pool.QueryRow(ctx, `SELECT version, hash FROM error_tracking_schema_migration ORDER BY version DESC LIMIT 1`).Scan(&version, &hash); err != nil {
		return databaseFailure(ctx, "read migration ledger", err)
	}
	if version != CurrentSchemaVersion || !strings.EqualFold(hash, SchemaHash()) {
		return fmt.Errorf("error tracking schema is not current; run error-tracking migrate")
	}
	return nil
}
