package migrations

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"xorm.io/xorm"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
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

	mg := NewMigrator(x, &setting.Cfg{})
	migrations := &OSSMigrations{}
	migrations.AddMigration(mg)
	expectedMigrations := mg.MigrationsCount()

	err = mg.Start()
	require.NoError(t, err)

	has, err := x.SQL(query).Get(&result)
	require.NoError(t, err)
	require.True(t, has)

	require.Equalf(t, expectedMigrations, result.Count, getDiffBetweenMigrationAndDb(t, mg))

	mg = NewMigrator(x, &setting.Cfg{})
	migrations.AddMigration(mg)

	err = mg.Start()
	require.NoError(t, err)

	has, err = x.SQL(query).Get(&result)
	require.NoError(t, err)
	require.True(t, has)
	require.Equalf(t, expectedMigrations, result.Count, getDiffBetweenMigrationAndDb(t, mg))
}

func getDiffBetweenMigrationAndDb(t *testing.T, mg *Migrator) string {
	t.Helper()
	ids := mg.GetMigrationIDs()
	log, err := mg.GetMigrationLog()
	require.NoError(t, err)
	missing := make([]string, 0)
	for _, id := range ids {
		_, ok := log[id]
		if !ok {
			missing = append(missing, id)
		}
	}
	notIntended := make([]string, 0)
	for logId := range log {
		found := false
		for _, s := range ids {
			found = s == logId
			if found {
				break
			}
		}
		if !found {
			notIntended = append(notIntended, logId)
		}
	}
	var msg string
	if len(missing) > 0 {
		msg = fmt.Sprintf("was not executed [%v], ", strings.Join(missing, ", "))
	}
	if len(notIntended) > 0 {
		msg += fmt.Sprintf("executed but should not [%v]", strings.Join(notIntended, ", "))
	}
	return msg
}
