package kv

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
)

func setupSQLKVMock(t *testing.T, driverName string) (*SqlKV, *sql.DB, sqlmock.Sqlmock) {
	t.Helper()

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = db.Close()
	})

	store, err := NewSQLKV(db, driverName)
	require.NoError(t, err)

	sqlKV, ok := store.(*SqlKV)
	require.True(t, ok)

	return sqlKV, db, mock
}

func TestSQLKVUnixTimestamp(t *testing.T) {
	for _, tc := range []struct {
		driverName string
		query      string
	}{
		{driverName: "mysql", query: "SELECT UNIX_TIMESTAMP()"},
		{driverName: "postgres", query: "SELECT FLOOR(EXTRACT(EPOCH FROM statement_timestamp()))::BIGINT"},
		{driverName: "sqlite", query: "SELECT unixepoch('now')"},
	} {
		t.Run(tc.driverName, func(t *testing.T) {
			store, _, mock := setupSQLKVMock(t, tc.driverName)
			const expected int64 = 1234567890
			mock.ExpectQuery(regexp.QuoteMeta(tc.query)).
				WillReturnRows(sqlmock.NewRows([]string{"timestamp"}).AddRow(expected))

			timestamp, err := store.UnixTimestamp(t.Context())
			require.NoError(t, err)
			require.Equal(t, expected, timestamp)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestSQLKVUnixTimestampErrors(t *testing.T) {
	queryErr := errors.New("query failed")
	for _, tc := range []struct {
		name string
		rows *sqlmock.Rows
		err  error
	}{
		{name: "query error", err: queryErr},
		{name: "no rows", rows: sqlmock.NewRows([]string{"timestamp"}), err: sql.ErrNoRows},
		{name: "invalid timestamp", rows: sqlmock.NewRows([]string{"timestamp"}).AddRow("invalid")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store, _, mock := setupSQLKVMock(t, "sqlite")
			expectation := mock.ExpectQuery(regexp.QuoteMeta("SELECT unixepoch('now')"))
			if tc.rows != nil {
				expectation.WillReturnRows(tc.rows)
			} else {
				expectation.WillReturnError(tc.err)
			}

			timestamp, err := store.UnixTimestamp(t.Context())
			require.ErrorContains(t, err, "failed to get unix timestamp")
			if tc.err != nil {
				require.ErrorIs(t, err, tc.err)
			}
			require.Zero(t, timestamp)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestSQLKVUnixTimestampUsesContextTransaction(t *testing.T) {
	store, db, mock := setupSQLKVMock(t, "sqlite")
	db.SetMaxOpenConns(1)
	mock.ExpectBegin()
	tx, err := db.BeginTx(t.Context(), nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback() })

	mock.ExpectQuery(regexp.QuoteMeta("SELECT unixepoch('now')")).
		WillReturnRows(sqlmock.NewRows([]string{"timestamp"}).AddRow(int64(1234567890)))
	mock.ExpectRollback()

	// Bound the pool wait if UnixTimestamp stops reusing the transaction's connection.
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()

	timestamp, err := store.UnixTimestamp(ContextWithDBTX(ctx, tx))
	require.NoError(t, err)
	require.Equal(t, int64(1234567890), timestamp)
	require.NoError(t, tx.Rollback())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSQLKVSaveRejectsUnknownSection(t *testing.T) {
	store, _, _ := setupSQLKVMock(t, "sqlite")
	w, err := store.Save(t.Context(), "unknown", "key")
	require.EqualError(t, err, "invalid section: unknown")
	require.Nil(t, w)
}

func buildDataImportRows(count int) []DataImportRow {
	rows := make([]DataImportRow, count)
	for i := range count {
		rows[i] = DataImportRow{
			GUID:    fmt.Sprintf("guid-%d", i),
			KeyPath: fmt.Sprintf("unified/data/group/resource/ns/name-%04d/1~created~", i),
			Value:   fmt.Appendf(nil, `{"name":"item-%04d"}`, i),
		}
	}

	return rows
}

func TestDataImportBatchStatementCount(t *testing.T) {
	tests := []struct {
		name     string
		rowCount int
		maxRows  int
		expected int
	}{
		{
			name:     "zero rows",
			rowCount: 0,
			maxRows:  dataImportBatchDefaultMaxRows,
			expected: 0,
		},
		{
			name:     "non positive max rows",
			rowCount: 3,
			maxRows:  0,
			expected: 0,
		},
		{
			name:     "single statement",
			rowCount: 8,
			maxRows:  8,
			expected: 1,
		},
		{
			name:     "multiple statements",
			rowCount: 9,
			maxRows:  8,
			expected: 2,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, dataImportBatchStatementCount(tc.rowCount, tc.maxRows))
		})
	}
}

func TestDataImportBatchPayloadBytes(t *testing.T) {
	rows := []DataImportRow{
		{Value: []byte("abc")},
		{Value: []byte("de")},
		{Value: nil},
	}

	require.Equal(t, 5, dataImportBatchPayloadBytes(rows))
}

func TestSQLKVInsertDataImportBatchTransactionSelection(t *testing.T) {
	tests := []struct {
		name           string
		useExternalTx  bool
		expectedRows   int
		expectedResult int64
	}{
		{
			name:           "local transaction",
			expectedRows:   2,
			expectedResult: 2,
		},
		{
			name:           "external transaction",
			useExternalTx:  true,
			expectedRows:   2,
			expectedResult: 2,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			sqlKV, db, mock := setupSQLKVMock(t, "sqlite")
			ctx := context.Background()

			var tx *sql.Tx
			var err error
			if tc.useExternalTx {
				mock.ExpectBegin()
				tx, err = db.Begin()
				require.NoError(t, err)
				ctx = ContextWithDBTX(ctx, tx)
			} else {
				mock.ExpectBegin()
			}

			mock.ExpectExec("(?i)insert into .*resource_history").
				WillReturnResult(sqlmock.NewResult(0, tc.expectedResult))
			mock.ExpectCommit()

			err = sqlKV.InsertDataImportBatch(ctx, buildDataImportRows(tc.expectedRows))
			require.NoError(t, err)

			if tc.useExternalTx {
				require.NoError(t, tx.Commit())
			}

			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestSQLKVInsertDataImportBatchChunking(t *testing.T) {
	tests := []struct {
		name         string
		driverName   string
		rowCount     int
		expectedExec int
	}{
		{
			name:         "sqlite chunking",
			driverName:   "sqlite",
			rowCount:     dataImportBatchSQLiteMaxRows + 1,
			expectedExec: 2,
		},
		{
			name:         "mysql chunking",
			driverName:   "mysql",
			rowCount:     dataImportBatchDefaultMaxRows + 1,
			expectedExec: 2,
		},
		{
			name:         "postgres chunking",
			driverName:   "postgres",
			rowCount:     dataImportBatchDefaultMaxRows + 1,
			expectedExec: 2,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			sqlKV, _, mock := setupSQLKVMock(t, tc.driverName)

			mock.ExpectBegin()
			for i := 0; i < tc.expectedExec; i++ {
				mock.ExpectExec("(?i)insert into .*resource_history").
					WillReturnResult(sqlmock.NewResult(0, 1))
			}
			mock.ExpectCommit()

			err := sqlKV.InsertDataImportBatch(context.Background(), buildDataImportRows(tc.rowCount))
			require.NoError(t, err)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestSQLKVInsertDataImportBatchRollsBackOnExecError(t *testing.T) {
	sqlKV, _, mock := setupSQLKVMock(t, "sqlite")
	expectedErr := errors.New("insert failed")

	mock.ExpectBegin()
	mock.ExpectExec("(?i)insert into .*resource_history").
		WillReturnError(expectedErr)
	mock.ExpectRollback()

	err := sqlKV.InsertDataImportBatch(context.Background(), buildDataImportRows(2))
	require.ErrorIs(t, err, expectedErr)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSQLKVWithStatementTimeout(t *testing.T) {
	setTimeout := regexp.QuoteMeta("SET LOCAL statement_timeout = 60000")
	setErr := errors.New("set failed")
	fnErr := errors.New("fn failed")

	t.Run("runs fn in a committed transaction with the timeout", func(t *testing.T) {
		sqlKV, _, mock := setupSQLKVMock(t, "postgres")
		mock.ExpectBegin()
		mock.ExpectExec(setTimeout).WillReturnResult(sqlmock.NewResult(0, 0))
		mock.ExpectCommit()

		err := sqlKV.WithStatementTimeout(context.Background(), time.Minute, func(ctx context.Context) error {
			_, ok := dbtxFromCtx(ctx)
			require.True(t, ok, "fn gets the transaction")
			return nil
		})
		require.NoError(t, err)
		require.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("rolls back when setting the timeout fails", func(t *testing.T) {
		sqlKV, _, mock := setupSQLKVMock(t, "postgres")
		mock.ExpectBegin()
		mock.ExpectExec(setTimeout).WillReturnError(setErr)
		mock.ExpectRollback()

		err := sqlKV.WithStatementTimeout(context.Background(), time.Minute, func(context.Context) error {
			t.Fatal("fn must not run")
			return nil
		})
		require.ErrorIs(t, err, setErr)
		require.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("rolls back and returns the fn error", func(t *testing.T) {
		sqlKV, _, mock := setupSQLKVMock(t, "postgres")
		mock.ExpectBegin()
		mock.ExpectExec(setTimeout).WillReturnResult(sqlmock.NewResult(0, 0))
		mock.ExpectRollback()

		err := sqlKV.WithStatementTimeout(context.Background(), time.Minute, func(context.Context) error { return fnErr })
		require.ErrorIs(t, err, fnErr)
		require.NoError(t, mock.ExpectationsWereMet())
	})

	for _, tc := range []struct {
		name       string
		driverName string
		timeout    time.Duration
		externalTx bool
	}{
		{name: "zero timeout", driverName: "postgres"},
		{name: "mysql", driverName: "mysql", timeout: time.Minute},
		{name: "sqlite", driverName: "sqlite", timeout: time.Minute},
		{name: "context transaction", driverName: "postgres", timeout: time.Minute, externalTx: true},
	} {
		t.Run("runs fn as is with "+tc.name, func(t *testing.T) {
			sqlKV, db, mock := setupSQLKVMock(t, tc.driverName)
			ctx := context.Background()
			if tc.externalTx {
				mock.ExpectBegin()
				tx, err := db.Begin()
				require.NoError(t, err)
				ctx = ContextWithDBTX(ctx, tx)
			}

			err := sqlKV.WithStatementTimeout(ctx, tc.timeout, func(got context.Context) error {
				require.Equal(t, ctx, got, "fn gets the caller's context")
				return fnErr
			})
			require.ErrorIs(t, err, fnErr)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestSQLKVInsertDataImportBatchUsesPlaceholderFields(t *testing.T) {
	sqlKV, _, mock := setupSQLKVMock(t, "sqlite")
	rows := buildDataImportRows(1)

	mock.ExpectBegin()
	mock.ExpectExec("(?i)insert into .*resource_history").
		WithArgs(
			rows[0].GUID,
			rows[0].KeyPath,
			rows[0].Value,
			"", "", "", "", 0, "",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := sqlKV.InsertDataImportBatch(context.Background(), rows)
	require.NoError(t, err)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSQLKV_BatchDelete_RejectsOversizedBatch(t *testing.T) {
	sqlKV, _, mock := setupSQLKVMock(t, "sqlite")

	keys := make([]string, maxBatchDeleteKeys)
	for i := range keys {
		keys[i] = fmt.Sprintf("k-%04d", i)
	}

	// A batch at or above the max is rejected before any DELETE runs.
	require.Error(t, sqlKV.BatchDelete(context.Background(), DataSection, keys))

	// One below the max runs as a single DELETE with that many key_path args.
	allowed := keys[:maxBatchDeleteKeys-1]
	mock.ExpectExec(`(?i)delete from .*resource_history.* where .*key_path.* in \(`).
		WithArgs(anyArgs(len(allowed))...).
		WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, sqlKV.BatchDelete(context.Background(), DataSection, allowed))
	require.NoError(t, mock.ExpectationsWereMet())
}

// anyArgs returns n matchers, so WithArgs asserts exactly n arguments in the statement.
func anyArgs(n int) []driver.Value {
	args := make([]driver.Value, n)
	for i := range args {
		args[i] = sqlmock.AnyArg()
	}
	return args
}

func TestSQLKV_Batch_RejectsDataSection(t *testing.T) {
	sqlKV, _, mock := setupSQLKVMock(t, "sqlite")

	err := sqlKV.Batch(context.Background(), DataSection, []BatchOp{
		{Mode: BatchOpPut, Key: "k", Value: []byte("v")},
	})
	require.ErrorIs(t, err, ErrBatchNotSupportedOnDataSection)
	// Reject must short-circuit before touching the DB.
	require.NoError(t, mock.ExpectationsWereMet())
}
