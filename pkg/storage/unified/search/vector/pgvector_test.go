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

func TestPartialHNSWName(t *testing.T) {
	require.Equal(t, "dashboards_stacks_123_hnsw", partialHNSWName("dashboards", "stacks-123"))
	require.Equal(t, "dashboards_weird__name_hnsw", partialHNSWName("dashboards", "weird!!name"))
	require.Equal(t, "dashboards_upper_ns_hnsw", partialHNSWName("dashboards", "UPPER-NS"))
}

func TestFitEmbedding(t *testing.T) {
	t.Run("exact size returns input unchanged", func(t *testing.T) {
		in := []float32{1, 2, 3, 4}
		got, err := fitEmbedding(in, 4)
		require.NoError(t, err)
		require.Equal(t, in, got)
	})

	t.Run("shorter is zero-padded to dim", func(t *testing.T) {
		got, err := fitEmbedding([]float32{1, 2, 3}, 6)
		require.NoError(t, err)
		require.Equal(t, []float32{1, 2, 3, 0, 0, 0}, got)
	})

	t.Run("padding does not mutate caller's slice", func(t *testing.T) {
		in := []float32{1, 2, 3}
		got, err := fitEmbedding(in, 5)
		require.NoError(t, err)
		// Mutate the result; original must be untouched.
		got[0] = 99
		require.Equal(t, []float32{1, 2, 3}, in)
	})

	t.Run("longer than dim returns error", func(t *testing.T) {
		_, err := fitEmbedding([]float32{1, 2, 3, 4, 5}, 3)
		require.Error(t, err)
		require.Contains(t, err.Error(), "5 dims")
		require.Contains(t, err.Error(), "at most 3")
	})

	t.Run("empty input pads to dim of zeros", func(t *testing.T) {
		got, err := fitEmbedding(nil, 4)
		require.NoError(t, err)
		require.Equal(t, []float32{0, 0, 0, 0}, got)
	})

	t.Run("dim of zero rejects any non-empty input", func(t *testing.T) {
		_, err := fitEmbedding([]float32{1}, 0)
		require.Error(t, err)
	})
}
