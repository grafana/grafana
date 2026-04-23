package vector

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/sql/test"
	"github.com/grafana/grafana/pkg/util/testutil"
)

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

func TestPgvectorBackend_Delete_EmptyModel_Rejected(t *testing.T) {
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB)
	ctx := testutil.NewDefaultTestContext(t)

	err := backend.Delete(ctx, "stacks-123", "", "dashboard.grafana.app/dashboards", "abc-uid")
	require.Error(t, err)
	require.Contains(t, err.Error(), "model must not be empty")
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestPgvectorBackend_Delete_MissingCollection(t *testing.T) {
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB)
	ctx := testutil.NewDefaultTestContext(t)

	rdb.SQLMock.ExpectQuery("SELECT id FROM vector_collections WHERE namespace").
		WithArgs("stacks-123", "test-model", "dashboard.grafana.app/dashboards").
		WillReturnError(sql.ErrNoRows)

	err := backend.Delete(ctx, "stacks-123", "test-model", "dashboard.grafana.app/dashboards", "abc-uid")
	require.NoError(t, err)
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestPgvectorBackend_DeleteSubresources_EmptySlice_NoOp(t *testing.T) {
	// Empty subresources should be a no-op without even looking at the catalog.
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB)
	ctx := testutil.NewDefaultTestContext(t)

	err := backend.DeleteSubresources(ctx, "stacks-123", "test-model", "dashboard.grafana.app/dashboards", "abc-uid", nil)
	require.NoError(t, err)
	err = backend.DeleteSubresources(ctx, "stacks-123", "test-model", "dashboard.grafana.app/dashboards", "abc-uid", []string{})
	require.NoError(t, err)
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestPgvectorBackend_GetCurrentContent_MissingCollection(t *testing.T) {
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB)
	ctx := testutil.NewDefaultTestContext(t)

	rdb.SQLMock.ExpectQuery("SELECT id FROM vector_collections WHERE namespace").
		WithArgs("stacks-123", "test-model", "dashboard.grafana.app/dashboards").
		WillReturnError(sql.ErrNoRows)

	content, err := backend.GetCurrentContent(ctx, "stacks-123", "test-model", "dashboard.grafana.app/dashboards", "abc-uid")
	require.NoError(t, err)
	require.Nil(t, content)
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestPgvectorBackend_GetLatestRV(t *testing.T) {
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB)
	ctx := testutil.NewDefaultTestContext(t)

	rdb.SQLMock.ExpectQuery("SELECT latest_rv FROM vector_latest_rv").
		WillReturnRows(rdb.SQLMock.NewRows([]string{"latest_rv"}).AddRow(int64(42)))

	rv, err := backend.GetLatestRV(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(42), rv)
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestPgvectorBackend_GetLatestRV_SeedRowMissing(t *testing.T) {
	// If the single-row seed ever vanishes, fall back to 0 rather than error.
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB)
	ctx := testutil.NewDefaultTestContext(t)

	rdb.SQLMock.ExpectQuery("SELECT latest_rv FROM vector_latest_rv").
		WillReturnError(sql.ErrNoRows)

	rv, err := backend.GetLatestRV(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(0), rv)
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestPgvectorBackend_Search_MissingCollection(t *testing.T) {
	// Search against a non-existent collection returns empty without error.
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB)
	ctx := testutil.NewDefaultTestContext(t)

	rdb.SQLMock.ExpectQuery("SELECT id FROM vector_collections WHERE namespace").
		WithArgs("stacks-123", "test-model", "dashboard.grafana.app/dashboards").
		WillReturnError(sql.ErrNoRows)

	results, err := backend.Search(ctx, "stacks-123", "test-model", "dashboard.grafana.app/dashboards",
		[]float32{0.1, 0.2}, 10)
	require.NoError(t, err)
	require.Empty(t, results)
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}
