package dbimpl

import (
	"context"
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDB_BeginTx(t *testing.T) {
	t.Parallel()
	registerTestSQLDrivers()
	ctx := context.Background()

	sqlDB, err := sql.Open(driverWithIsolationLevelName, "")
	require.NoError(t, err)
	require.NotNil(t, sqlDB)

	d := NewDB(sqlDB, driverWithIsolationLevelName)
	require.Equal(t, driverWithIsolationLevelName, d.DriverName())

	tx, err := d.BeginTx(ctx, nil)
	require.NoError(t, err)
	require.NotNil(t, tx)
}
