package vector

import (
	"context"
	"errors"
	"strings"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/sql/test"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestInternalPartitionKey(t *testing.T) {
	for _, tc := range []struct {
		resource, want string
		wantErr        bool
	}{
		{resource: "dashboards", want: "dashboards"},
		{resource: "Article-Tags", want: "article_tags"},
		{resource: "article_tags", want: "article_tags"},
		{resource: strings.Repeat("a", 39), want: strings.Repeat("a", 39)},
		{resource: strings.Repeat("a", 40), wantErr: true},
		{resource: "foo_external", wantErr: true},
		{resource: "foo-external", wantErr: true},
		{resource: "", wantErr: true},
	} {
		t.Run(tc.resource, func(t *testing.T) {
			got, err := InternalPartitionKey(tc.resource)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestEnsureCollection_RejectsReservedInternalPartition(t *testing.T) {
	rdb := test.NewDBProviderNopSQL(t)
	b := NewPgvectorBackend(t.Context(), rdb.DB, 1000, 0, false, nil)
	rdb.SQLMock.ExpectQuery("SELECT").WillReturnRows(emptyCatalogRows())
	_, err := b.EnsureCollection(t.Context(), "example.test", "foo-external", false)
	require.ErrorContains(t, err, "reserved partition key")
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestResolveCollection_CatalogRows(t *testing.T) {
	rdb := test.NewDBProviderNopSQL(t)
	b := NewPgvectorBackend(context.Background(), rdb.DB, 1000, 0, false, nil)
	ctx := testutil.NewDefaultTestContext(t)

	// A resource name with chars a table name can't hold maps to its
	// catalog-assigned partition key.
	rdb.SQLMock.ExpectQuery("SELECT").WillReturnRows(
		sqlmock.NewRows([]string{"group_name", "resource", "partition_key", "is_external"}).
			AddRow("ext.example.com", "my-things", "my_things", true))

	c, found, err := b.ResolveCollection(ctx, "ext.example.com", "my-things")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "my_things", c.PartitionKey)
	require.True(t, c.IsExternal)

	// Unknown pairs are not found rather than erroring.
	rdb.SQLMock.ExpectQuery("SELECT").WillReturnRows(emptyCatalogRows())
	_, found, err = b.ResolveCollection(ctx, "nope", "nope")
	require.NoError(t, err)
	require.False(t, found)
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestEnsureCollection_IsExternalMismatchIsRejected(t *testing.T) {
	// A resolve hit whose stored IsExternal disagrees with the caller's
	// isExternal must be rejected before any further DB work (no insert,
	// no partition DDL) — otherwise a fat-fingered allowlist entry could
	// hand external writers the internal collection.
	rdb := test.NewDBProviderNopSQL(t)
	b := NewPgvectorBackend(context.Background(), rdb.DB, 1000, 0, false, nil)
	ctx := testutil.NewDefaultTestContext(t)

	rdb.SQLMock.ExpectQuery("SELECT").WillReturnRows(
		sqlmock.NewRows([]string{"group_name", "resource", "partition_key", "is_external"}).
			AddRow("dashboard.grafana.app", "dashboards", "dashboards", false))

	_, err := b.EnsureCollection(ctx, "dashboard.grafana.app", "dashboards", true)
	require.Error(t, err)
	require.Contains(t, err.Error(), "is internal, not writable through the external API")
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}

func TestResolveCollection_DBErrorSurfaces(t *testing.T) {
	// Non-builtin lookups propagate catalog errors instead of silently
	// narrowing the catalog to the built-in entries.
	rdb := test.NewDBProviderNopSQL(t)
	b := NewPgvectorBackend(context.Background(), rdb.DB, 1000, 0, false, nil)
	ctx := testutil.NewDefaultTestContext(t)

	rdb.SQLMock.ExpectQuery("SELECT").WillReturnError(errors.New("db down"))
	_, _, err := b.ResolveCollection(ctx, "ext.example.com", "my-things")
	require.Error(t, err)
	require.NoError(t, rdb.SQLMock.ExpectationsWereMet())
}
