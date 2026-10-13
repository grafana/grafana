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

	sess := eng.NewSession()
	defer sess.Close()

	// The first row succeeds; evaluating the second row overflows SQLite's
	// integer abs(). This must fail during iteration, not query preparation.
	rows, err := sess.SQL("SELECT 1 AS id UNION ALL SELECT abs(-9223372036854775808)").Rows(new(TestStruct))
	require.NoError(t, err)
	defer rows.Close()

	require.True(t, rows.Next())
	first := &TestStruct{}
	require.NoError(t, rows.Scan(first))
	require.False(t, rows.Next())
	require.ErrorContains(t, rows.Err(), "integer overflow")
	require.NotErrorIs(t, rows.Err(), sql.ErrNoRows)
	require.False(t, rows.Next())
	require.ErrorContains(t, rows.Err(), "integer overflow")
}
