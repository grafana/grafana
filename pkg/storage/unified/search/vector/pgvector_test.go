package vector

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/sql/test"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestVector_Validate(t *testing.T) {
	ok := Vector{Namespace: "ns", Model: "m", Resource: "r", UID: "u", Title: "t"}
	require.NoError(t, ok.Validate())

	cases := []struct {
		name    string
		mutate  func(*Vector)
		wantErr string
	}{
		{"empty namespace", func(v *Vector) { v.Namespace = "" }, "namespace must not be empty"},
		{"empty model", func(v *Vector) { v.Model = "" }, "model must not be empty"},
		{"empty resource", func(v *Vector) { v.Resource = "" }, "resource must not be empty"},
		{"empty uid", func(v *Vector) { v.UID = "" }, "uid must not be empty"},
		{"empty title", func(v *Vector) { v.Title = "" }, "title must not be empty"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			v := ok
			tc.mutate(&v)
			err := v.Validate()
			require.Error(t, err)
			require.Contains(t, err.Error(), tc.wantErr)
		})
	}
}

func TestValidateResource(t *testing.T) {
	cases := []struct {
		in      string
		wantErr bool
	}{
		{"dashboards", false},
		{"folders", true}, // not provisioned yet
		{"", true},
	}
	for _, tc := range cases {
		t.Run(tc.in, func(t *testing.T) {
			err := validateResource(tc.in)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestPgvectorBackend_Upsert_EmptySlice(t *testing.T) {
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB, 1000, 0)
	ctx := testutil.NewDefaultTestContext(t)

	require.NoError(t, backend.Upsert(ctx, nil))
	require.NoError(t, backend.Upsert(ctx, []Vector{}))
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestPgvectorBackend_Upsert_InvalidVector_Rejected(t *testing.T) {
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB, 1000, 0)
	ctx := testutil.NewDefaultTestContext(t)

	err := backend.Upsert(ctx, []Vector{
		{Namespace: "ns", Model: "m", Resource: "dashboards", UID: "", Content: "x", Embedding: []float32{0.1}},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "uid must not be empty")
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestPgvectorBackend_Upsert_UnknownResource_Rejected(t *testing.T) {
	// Unknown resource has no shared table; Upsert errors before any DB work.
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB, 1000, 0)
	ctx := testutil.NewDefaultTestContext(t)

	rdb.SQLMock.ExpectBegin()
	rdb.SQLMock.ExpectRollback()

	err := backend.Upsert(ctx, []Vector{
		{Namespace: "ns", Model: "m", Resource: "folders", UID: "x", Title: "t", Embedding: []float32{0.1}},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "unsupported resource")
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestPgvectorBackend_Delete_EmptyModel_Rejected(t *testing.T) {
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB, 1000, 0)
	ctx := testutil.NewDefaultTestContext(t)

	err := backend.Delete(ctx, "ns", "", "dashboards", "dash-1")
	require.Error(t, err)
	require.Contains(t, err.Error(), "model must not be empty")
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestPgvectorBackend_DeleteSubresources_EmptySlice_NoOp(t *testing.T) {
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB, 1000, 0)
	ctx := testutil.NewDefaultTestContext(t)

	require.NoError(t, backend.DeleteSubresources(ctx, "ns", "m", "dashboards", "dash-1", nil))
	require.NoError(t, backend.DeleteSubresources(ctx, "ns", "m", "dashboards", "dash-1", []string{}))
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestPgvectorBackend_GetLatestRV(t *testing.T) {
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB, 1000, 0)
	ctx := testutil.NewDefaultTestContext(t)

	rdb.SQLMock.ExpectQuery("SELECT latest_rv FROM vector_latest_rv").
		WillReturnRows(rdb.SQLMock.NewRows([]string{"latest_rv"}).AddRow(int64(42)))

	rv, err := backend.GetLatestRV(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(42), rv)
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestPgvectorBackend_GetLatestRV_SeedRowMissing(t *testing.T) {
	rdb := test.NewDBProviderNopSQL(t)
	backend := NewPgvectorBackend(rdb.DB, 1000, 0)
	ctx := testutil.NewDefaultTestContext(t)

	rdb.SQLMock.ExpectQuery("SELECT latest_rv FROM vector_latest_rv").
		WillReturnError(sql.ErrNoRows)

	rv, err := backend.GetLatestRV(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(0), rv)
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestLeafName(t *testing.T) {
	require.Equal(t, "embeddings_dashboards_stacks_123", leafName("dashboards", "stacks-123"))
	require.Equal(t, "embeddings_dashboards_weird__name", leafName("dashboards", "weird!!name"))
	require.Equal(t, "embeddings_dashboards_upper_ns", leafName("dashboards", "UPPER-NS"))
}
