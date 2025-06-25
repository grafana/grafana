package sql

import (
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/test"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func expectSuccessfulResourceVersionLock(t *testing.T, dbp test.TestDBProvider, rv int64, timestamp int64) {
	dbp.SQLMock.ExpectQuery("select resource_version, unix_timestamp for update").
		WillReturnRows(sqlmock.NewRows([]string{"resource_version", "unix_timestamp"}).
			AddRow(rv, timestamp))
}

func expectSuccessfulResourceVersionSaveRV(t *testing.T, dbp test.TestDBProvider) {
	dbp.SQLMock.ExpectExec("update resource set resource_version").WillReturnResult(sqlmock.NewResult(1, 1))
	dbp.SQLMock.ExpectExec("update resource_history set resource_version").WillReturnResult(sqlmock.NewResult(1, 1))
	dbp.SQLMock.ExpectExec("update resource_version set resource_version").WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectSuccessfulResourceVersionExec(t *testing.T, dbp test.TestDBProvider, cbs ...func()) {
	for _, cb := range cbs {
		cb()
	}
	expectSuccessfulResourceVersionLock(t, dbp, 100, 200)
	expectSuccessfulResourceVersionSaveRV(t, dbp)
}

func TestResourceVersionManager(t *testing.T) {
	ctx := testutil.NewDefaultTestContext(t)
	dbp := test.NewDBProviderMatchWords(t)
	dialect := sqltemplate.DialectForDriver(dbp.DB.DriverName())
	manager, err := NewResourceVersionManager(ResourceManagerOptions{
		DB:      dbp.DB,
		Dialect: dialect,
	})
	require.NoError(t, err)
	require.NotNil(t, manager)

	t.Run("should handle single operation", func(t *testing.T) {
		key := &resourcepb.ResourceKey{
			Group:    "test-group",
			Resource: "test-resource",
		}
		dbp.SQLMock.ExpectBegin()
		expectSuccessfulResourceVersionExec(t, dbp, func() {
			dbp.SQLMock.ExpectExec("select 1").WillReturnResult(sqlmock.NewResult(1, 1))
		})
		dbp.SQLMock.ExpectCommit()

		rv, err := manager.ExecWithRV(ctx, key, func(tx db.Tx) (string, error) {
			_, err := tx.ExecContext(ctx, "select 1")
			return "1234", err
		})
		require.NoError(t, err)
		require.Equal(t, rv, int64(200))
	})
}
