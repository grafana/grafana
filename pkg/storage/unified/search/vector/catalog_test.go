package vector

import (
	"context"
	"errors"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/sql/test"
	"github.com/grafana/grafana/pkg/util/testutil"
)

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
