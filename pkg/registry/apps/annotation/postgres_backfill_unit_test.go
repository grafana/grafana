package annotation

import (
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry/apps/annotation/migrator"
)

// These cover the SQL and arg builders without a database, so drift between
// annotationColumns, annotationArgs and the generated statements is caught in the
// default unit suite.

func TestAnnotationArgs_CoversEveryColumn(t *testing.T) {
	args := annotationArgs(migrator.BackfillRecord{
		Namespace: "stacks-1", Name: "legacy-1", Time: 100,
		Text: "t", CreatedBy: "user:u", CreatedAt: time.UnixMilli(1).UTC(), LegacyID: 7,
	})
	for _, col := range annotationColumns {
		_, ok := args[col]
		require.Truef(t, ok, "annotationArgs is missing a value for column %q", col)
	}
	require.Len(t, args, annotationColumnCount, "annotationArgs must not bind extra columns")
}

func TestAnnotationArgs_EmptyToNull(t *testing.T) {
	args := annotationArgs(migrator.BackfillRecord{Namespace: "ns", Name: "n"})
	require.Nil(t, args["created_by"], "empty CreatedBy must bind NULL")
	require.Nil(t, args["legacy_id"], "zero LegacyID must bind NULL")
}

func TestUpdateMigratedSQL(t *testing.T) {
	setClause, whereClause, found := strings.Cut(updateMigratedSQL, " WHERE ")
	require.True(t, found, "update must have a WHERE clause")

	// Identity is matched in WHERE, never in SET; time is in SET, so the row can move.
	for col := range annotationMatchColumns {
		require.Contains(t, whereClause, col+" = @"+col)
		require.NotContains(t, setClause, col+" = @"+col)
	}
	require.Contains(t, setClause, "time = @time")
	for _, col := range updatableColumns() {
		require.Contains(t, setClause, col+" = @"+col)
	}

	// Pinning time would stop Postgres moving the row when the annotation's changed.
	require.NotContains(t, whereClause, "time =", "the update must not pin time")
	require.Contains(t, whereClause, "legacy_migrated", "the update must match on provenance")

	// Provenance and the tombstone are read, never written.
	require.NotContains(t, setClause, "legacy_migrated")
	require.NotContains(t, setClause, "deleted_at")
}

// Without this guard the resync rewrites the rows in its lookback window on every
// cycle, since they stay in the window for as long as the head does not move.
func TestUpdateMigratedSQLSkipsUnchangedRows(t *testing.T) {
	_, whereClause, found := strings.Cut(updateMigratedSQL, " WHERE ")
	require.True(t, found)

	require.Contains(t, whereClause, "IS DISTINCT FROM", "an unchanged row must not be rewritten")
	// Every column the update can write has to be compared, or a change to one the
	// comparison misses is silently dropped.
	for _, col := range updatableColumns() {
		require.Containsf(t, whereClause, col, "column %q is written but never compared", col)
	}
}

// pgx silently binds NULL for an @name it cannot find, so one the args miss would
// blank a column rather than fail.
func TestUpdateMigratedSQLBindsEveryNamedParameter(t *testing.T) {
	args := annotationArgs(migrator.BackfillRecord{Namespace: "ns", Name: "legacy-1", Time: 1})
	named := regexp.MustCompile(`@([a-zA-Z_][a-zA-Z0-9_]*)`)

	for _, match := range named.FindAllStringSubmatch(updateMigratedSQL, -1) {
		_, ok := args[match[1]]
		require.Truef(t, ok, "the update references @%s, which annotationArgs does not bind", match[1])
	}
}

// The resync only ever rewrites the columns it read from legacy.
func TestResyncStatementOnlyWritesRecordColumns(t *testing.T) {
	upper := strings.ToUpper(updateMigratedSQL)
	require.NotContains(t, upper, "DELETE FROM", "the resync must not delete rows")
	require.NotContains(t, upper, "TRUNCATE", "the resync must not truncate")
	require.NotContains(t, upper, "INSERT INTO", "the backfill is the only writer of new rows")
	require.NotContains(t, updateMigratedSQL, "deleted_at =", "the resync must not write a tombstone")
}

func TestIsRetryableTxError(t *testing.T) {
	// What a cross-partition row move races against; the batch is idempotent, so
	// replaying it is the fix.
	require.True(t, isRetryableTxError(&pgconn.PgError{Code: "40001"}))
	require.True(t, isRetryableTxError(&pgconn.PgError{Code: "40P01"}))
	// A unique violation means a name holds two rows, which retrying cannot fix.
	require.False(t, isRetryableTxError(&pgconn.PgError{Code: "23505"}))
	require.False(t, isRetryableTxError(fmt.Errorf("boom")))
	require.False(t, isRetryableTxError(fmt.Errorf("wrapped: %w", &pgconn.PgError{Code: "42P01"})))
	require.True(t, isRetryableTxError(fmt.Errorf("wrapped: %w", &pgconn.PgError{Code: "40001"})))
}
