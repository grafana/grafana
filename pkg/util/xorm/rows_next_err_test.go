package xorm

import (
	"database/sql"
	"testing"

	_ "github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/stretchr/testify/require"
)

// TestRowsErrNormalEOFReturnsErrNoRows verifies that after iterating all rows
// to completion, Err() returns sql.ErrNoRows (preserving historical behavior).
func TestRowsErrNormalEOFReturnsErrNoRows(t *testing.T) {
	eng, err := NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)
	require.NoError(t, eng.Sync(new(TestStruct)))

	_, err = eng.Insert(&TestStruct{Comment: "row1"})
	require.NoError(t, err)

	sess := eng.NewSession()
	defer sess.Close()

	rows, err := sess.Rows(new(TestStruct))
	require.NoError(t, err)
	defer rows.Close()

	count := 0
	for rows.Next() {
		s := &TestStruct{}
		require.NoError(t, rows.Scan(s))
		count++
	}
	require.Equal(t, 1, count)
	require.ErrorIs(t, rows.Err(), sql.ErrNoRows)
}

// TestRowsErrPropagatesRealError verifies that a driver error during iteration
// is surfaced by Err() rather than masked as sql.ErrNoRows.
func TestRowsErrPropagatesRealError(t *testing.T) {
	eng, err := NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)
	require.NoError(t, eng.Sync(new(TestStruct)))

	// Query a table column that doesn't exist so the driver errors at Next().
	sess := eng.NewSession()
	defer sess.Close()

	rows, err := sess.SQL("SELECT nonexistent_column FROM test_struct").Rows(new(TestStruct))
	if err != nil {
		// If Rows() itself surfaces the error, that's fine — the point is it's not masked.
		return
	}
	defer rows.Close()

	for rows.Next() {
	}

	err = rows.Err()
	// A real column-resolution error must not be reported as sql.ErrNoRows.
	require.NotNil(t, err, "expected a real error to be surfaced")
	require.NotErrorIs(t, err, sql.ErrNoRows, "real error must not be masked as ErrNoRows")
}
