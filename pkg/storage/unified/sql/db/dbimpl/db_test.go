package dbimpl

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestDB_BeginTx(t *testing.T) {
	t.Parallel()
	registerTestSQLDrivers()
	ctx := testutil.NewDefaultTestContext(t)

	sqlDB, err := sql.Open(driverWithIsolationLevelName, "")
	require.NoError(t, err)
	require.NotNil(t, sqlDB)

	d := NewDB(sqlDB, driverWithIsolationLevelName)
	require.Equal(t, driverWithIsolationLevelName, d.DriverName())

	tx, err := d.BeginTx(ctx, nil)
	require.NoError(t, err)
	require.NotNil(t, tx)
}
