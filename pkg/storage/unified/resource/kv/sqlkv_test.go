package kv

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"

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

func buildDataImportRows(count int) []DataImportRow {
	rows := make([]DataImportRow, count)
	for i := 0; i < count; i++ {
		rows[i] = DataImportRow{
			GUID:    fmt.Sprintf("guid-%d", i),
			KeyPath: fmt.Sprintf("unified/data/group/resource/ns/name-%04d/1~created~", i),
			Value:   []byte(fmt.Sprintf(`{"name":"item-%04d"}`, i)),
		}
	}

	return rows
}

func buildLegacyDataImportRows(count int) []DataImportRow {
	rows := buildDataImportRows(count)
	for i := range rows {
		rows[i].Legacy = &DataImportLegacyFields{
			Group:           "group",
			Resource:        "resource",
			Namespace:       "ns",
			Name:            fmt.Sprintf("name-%04d", i),
			Action:          1,
			Folder:          "folder",
			ResourceVersion: int64(i + 1),
			PreviousRV:      int64(i),
			Generation:      int64(i + 10),
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

func TestSQLKVInsertDataImportBatchUsesLegacyFields(t *testing.T) {
	sqlKV, _, mock := setupSQLKVMock(t, "sqlite")
	rows := buildLegacyDataImportRows(1)

	mock.ExpectBegin()
	mock.ExpectExec("(?i)insert into .*resource_history").
		WithArgs(
			rows[0].GUID,
			rows[0].KeyPath,
			rows[0].Value,
			rows[0].Legacy.Group,
			rows[0].Legacy.Resource,
			rows[0].Legacy.Namespace,
			rows[0].Legacy.Name,
			rows[0].Legacy.Action,
			rows[0].Legacy.Folder,
			rows[0].Legacy.ResourceVersion,
			rows[0].Legacy.PreviousRV,
			rows[0].Legacy.Generation,
			nil,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := sqlKV.InsertDataImportBatch(context.Background(), rows)
	require.NoError(t, err)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSQLKVInsertDataImportBatchRejectsMixedLegacyRows(t *testing.T) {
	tests := []struct {
		name      string
		buildRows func() []DataImportRow
	}{
		{
			name: "legacy after non-legacy",
			buildRows: func() []DataImportRow {
				rows := buildDataImportRows(2)
				rows[1].Legacy = &DataImportLegacyFields{
					Group:           "group",
					Resource:        "resource",
					Namespace:       "ns",
					Name:            "name-0001",
					Action:          1,
					Folder:          "folder",
					ResourceVersion: 2,
					PreviousRV:      1,
					Generation:      11,
				}
				return rows
			},
		},
		{
			name: "non-legacy after legacy",
			buildRows: func() []DataImportRow {
				rows := buildLegacyDataImportRows(2)
				rows[1].Legacy = nil
				return rows
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			sqlKV, _, mock := setupSQLKVMock(t, "sqlite")

			mock.ExpectBegin()
			mock.ExpectRollback()

			err := sqlKV.InsertDataImportBatch(context.Background(), tc.buildRows())
			require.ErrorContains(t, err, "mixed legacy import rows")
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}
