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
	expectedMigrations := mg.GetMigrationIDs(true)

	err = mg.Start()
	require.NoError(t, err)

	has, err := x.SQL(query).Get(&result)
	require.NoError(t, err)
	require.True(t, has)

	checkStepsAndDatabaseMatch(t, mg, expectedMigrations)

	mg = NewMigrator(x, &setting.Cfg{})
	migrations.AddMigration(mg)

	err = mg.Start()
	require.NoError(t, err)

	has, err = x.SQL(query).Get(&result)
	require.NoError(t, err)
	require.True(t, has)
	checkStepsAndDatabaseMatch(t, mg, expectedMigrations)
}

func checkStepsAndDatabaseMatch(t *testing.T, mg *Migrator, expected []string) {
	t.Helper()
	log, err := mg.GetMigrationLog()
	require.NoError(t, err)
	missing := make([]string, 0)
	for _, id := range expected {
		_, ok := log[id]
		if !ok {
			missing = append(missing, id)
		}
	}
	notIntended := make([]string, 0)
	for logId := range log {
		found := false
		for _, s := range expected {
			found = s == logId
			if found {
				break
			}
		}
		if !found {
			notIntended = append(notIntended, logId)
		}
	}

	if len(missing) == 0 && len(notIntended) == 0 {
		return
	}

	var msg string
	if len(missing) > 0 {
		msg = fmt.Sprintf("was not executed [%v], ", strings.Join(missing, ", "))
	}
	if len(notIntended) > 0 {
		msg += fmt.Sprintf("executed but should not [%v]", strings.Join(notIntended, ", "))
	}
	require.Failf(t, "the number of migrations does not match log in database", msg)
}
