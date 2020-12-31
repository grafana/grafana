package migrations

import (
	"testing"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/stretchr/testify/require"
	"xorm.io/xorm"
)

func TestMigrations(t *testing.T) {
	testDB := sqlutil.SQLite3TestDB()
	const query = `select count(*) as count from migration_log`
	result := struct{ Count int }{}

	x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)

	err = NewDialect(x).CleanDB()
	require.NoError(t, err)

	_, err = x.SQL(query).Get(&result)
	require.Error(t, err)

	mg := NewMigrator(x)
	AddMigrations(mg)
	expectedMigrations := mg.MigrationsCount()

	err = mg.Start()
	require.NoError(t, err)

	has, err := x.SQL(query).Get(&result)
	require.NoError(t, err)
	require.True(t, has)

	require.Equal(t, expectedMigrations, result.Count)

	mg = NewMigrator(x)
	AddMigrations(mg)

	err = mg.Start()
	require.NoError(t, err)

	has, err = x.SQL(query).Get(&result)
	require.NoError(t, err)
	require.True(t, has)
	require.Equal(t, expectedMigrations, result.Count)
}
