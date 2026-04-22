package vector

import (
	"database/sql"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/sql/test"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestSanitizePartitionNames(t *testing.T) {
	tests := []struct {
		name         string
		namespace    string
		model        string
		expectedNs   string
		expectedLeaf string
	}{
		{"simple", "stacks-123", "text-embedding-005",
			"resource_embeddings_stacks_123",
			"resource_embeddings_stacks_123__text_embedding_005"},
		{"default namespace", "default", "test-model",
			"resource_embeddings_default",
			"resource_embeddings_default__test_model"},
		{"dots in namespace", "org.with.dots", "m",
			"resource_embeddings_org_with_dots",
			"resource_embeddings_org_with_dots__m"},
		{"uppercase input", "UPPER-case", "Model-X",
			"resource_embeddings_upper_case",
			"resource_embeddings_upper_case__model_x"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			nsName, modelName := sanitizePartitionNames(tt.namespace, tt.model)
			assert.Equal(t, tt.expectedNs, nsName)
			assert.Equal(t, tt.expectedLeaf, modelName)
		})
	}
}

func TestPgvectorBackend_Upsert_EmptySlice(t *testing.T) {
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB)

	ctx := testutil.NewDefaultTestContext(t)

	// nil slice: no-op, no DB interaction.
	err := backend.Upsert(ctx, nil)
	require.NoError(t, err)

	// empty slice: no-op, no DB interaction.
	err = backend.Upsert(ctx, []Vector{})
	require.NoError(t, err)

	// sqlmock will fail the test if any unexpected queries were issued.
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestPgvectorBackend_Delete(t *testing.T) {
	t.Run("delete all (olderThanRV=0)", func(t *testing.T) {
		rdb := test.NewDBProviderNopSQL(t)
		backend := NewPgvectorBackend(rdb.DB)
		ctx := testutil.NewDefaultTestContext(t)

		rdb.SQLMock.ExpectExec("").WillReturnResult(sqlmock.NewResult(0, 1))

		err := backend.Delete(ctx, "stacks-123", "", "dashboard.grafana.app", "dashboards", "abc-uid", 0)
		require.NoError(t, err)
		require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
	})

	t.Run("delete stale (olderThanRV>0)", func(t *testing.T) {
		rdb := test.NewDBProviderNopSQL(t)
		backend := NewPgvectorBackend(rdb.DB)
		ctx := testutil.NewDefaultTestContext(t)

		rdb.SQLMock.ExpectExec("").WillReturnResult(sqlmock.NewResult(0, 0))

		err := backend.Delete(ctx, "stacks-123", "test-model", "dashboard.grafana.app", "dashboards", "abc-uid", 42)
		require.NoError(t, err)
		require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
	})
}

func TestPgvectorBackend_GetLatestRV(t *testing.T) {
	t.Run("returns resource version from DB", func(t *testing.T) {
		rdb := test.NewDBProviderNopSQL(t)
		backend := NewPgvectorBackend(rdb.DB)
		ctx := testutil.NewDefaultTestContext(t)

		rows := rdb.SQLMock.NewRows([]string{"resource_version"}).AddRow(int64(99))
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rows)

		rv, err := backend.GetLatestRV(ctx, "stacks-123", "test-model")
		require.NoError(t, err)
		assert.Equal(t, int64(99), rv)
		require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
	})

	t.Run("returns ErrNoRows when no data", func(t *testing.T) {
		rdb := test.NewDBProviderNopSQL(t)
		backend := NewPgvectorBackend(rdb.DB)
		ctx := testutil.NewDefaultTestContext(t)

		rows := rdb.SQLMock.NewRows([]string{"resource_version"})
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rows)

		rv, err := backend.GetLatestRV(ctx, "stacks-123", "test-model")
		// dbutil.QueryRow wraps sql.ErrNoRows when the result set is empty.
		require.ErrorIs(t, err, sql.ErrNoRows)
		assert.Equal(t, int64(0), rv)
		require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
	})
}
