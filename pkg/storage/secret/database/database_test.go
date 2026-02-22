package database

import (
	"context"
	"errors"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/util/sqlite"
)

func TestDatabaseExecContext_RetriesBusyOrLockedErrors(t *testing.T) {
	t.Parallel()

	database, mock := newTestDatabase(t)
	mock.ExpectExec("SELECT 1").WillReturnError(sqlite.TestErrBusy)
	mock.ExpectExec("SELECT 1").WillReturnResult(sqlmock.NewResult(0, 1))

	res, err := database.ExecContext(t.Context(), "SELECT 1")
	require.NoError(t, err)

	rowsAffected, err := res.RowsAffected()
	require.NoError(t, err)
	require.Equal(t, int64(1), rowsAffected)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestDatabaseQueryContext_RetriesBusyOrLockedErrors(t *testing.T) {
	t.Parallel()

	database, mock := newTestDatabase(t)
	mock.ExpectQuery("SELECT 1").WillReturnError(sqlite.TestErrLocked)
	mock.ExpectQuery("SELECT 1").WillReturnRows(sqlmock.NewRows([]string{"value"}).AddRow("ok"))

	rows, err := database.QueryContext(t.Context(), "SELECT 1")
	require.NoError(t, err)
	defer func() { _ = rows.Close() }()
	require.True(t, rows.Next())
	var value string
	require.NoError(t, rows.Scan(&value))
	require.Equal(t, "ok", value)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestDatabaseExecContext_DoesNotRetryNonSQLiteBusyErrors(t *testing.T) {
	t.Parallel()

	database, mock := newTestDatabase(t)
	nonRetryableErr := errors.New("some other sql error")
	mock.ExpectExec("SELECT 1").WillReturnError(nonRetryableErr)

	_, err := database.ExecContext(context.Background(), "SELECT 1")
	require.ErrorIs(t, err, nonRetryableErr)
	require.NoError(t, mock.ExpectationsWereMet())
}

func newTestDatabase(t *testing.T) (*Database, sqlmock.Sqlmock) {
	t.Helper()

	db, mock, err := sqlmock.New()
	require.NoError(t, err)

	tracer := noop.NewTracerProvider().Tracer("test")
	return &Database{
		dbType: "sqlite3",
		sqlx:   sqlx.NewDb(db, "sqlite3"),
		tracer: tracer,
	}, mock
}
