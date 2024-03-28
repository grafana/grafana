package cloudmigrationimpl

import (
	"context"
	"encoding/json"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestMigrateDatasources(t *testing.T) {
	// TODO: Write this test
}

func TestGetAllCloudMigrations(t *testing.T) {
	testDB := db.InitTestDB(t)
	s := &sqlStore{db: testDB}
	ctx := context.Background()

	t.Run("get all cloud_migration", func(t *testing.T) {
		// replace this with proper method when created
		_, err := testDB.GetSqlxSession().Exec(ctx, `
			INSERT INTO cloud_migration (id, auth_token, stack, created, updated)
			VALUES (1, '12345', 'stack1', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000'),
 				(2, '6789', 'stack2', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000'),
 				(3, '777', 'stack3', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000');
		`)
		require.NoError(t, err)

		value, err := s.GetAllCloudMigrations(ctx)
		require.NoError(t, err)
		require.Equal(t, 3, len(value))
		for _, m := range value {
			switch m.ID {
			case 1:
				require.Equal(t, "stack1", m.Stack)
				require.Equal(t, "12345", m.AuthToken)
			case 2:
				require.Equal(t, "stack2", m.Stack)
				require.Equal(t, "6789", m.AuthToken)
			case 3:
				require.Equal(t, "stack3", m.Stack)
				require.Equal(t, "777", m.AuthToken)
			default:
				require.Fail(t, "ID value not expected: "+strconv.FormatInt(m.ID, 10))
			}
		}
	})
}

func TestGetAllCloudMigrationRuns(t *testing.T) {
	testDB := db.InitTestDB(t)
	s := &sqlStore{db: testDB}
	ctx := context.Background()

	t.Run("get all cloud_migration_run", func(t *testing.T) {
		resultJson, err := json.Marshal(cloudmigration.MigrationResult{Status: "ok", Message: "nothing"})
		require.NoError(t, err)
		require.NotNil(t, resultJson)

		resourcesJson, err := json.Marshal([]cloudmigration.MigratedResource{
			{Type: "dashboard", ID: "1", RefID: "1234", Name: "abcd", Result: cloudmigration.MigratedResourceResult{Status: "ok", Message: ""}},
			{Type: "datasource", ID: "2", RefID: "5678", Name: "efgh", Result: cloudmigration.MigratedResourceResult{Status: "error", Message: "db error"}},
		})
		require.NoError(t, err)
		require.NotNil(t, resourcesJson)

		// replace this with proper method when created
		//_, err = testDB.GetSqlxSession().Exec(ctx, `
		//	INSERT INTO cloud_migration_run (id, cloud_migration_uid, result, created, updated, finished, items)
		//	VALUES (1, 'cm_uid_123', ?, '2024-03-28 09:57:01.000', '2024-03-28 09:57:03.000', '2024-03-28 09:57:06.000', ?);
		//`, resultJson, resourcesJson)
		//require.NoError(t, err)

		run := &cloudmigration.CloudMigrationRun{
			//ID:                0,
			CloudMigrationUID: "cm_uid_123",
			Resources: []cloudmigration.MigratedResource{
				{Type: "dashboard", ID: "1", RefID: "1234", Name: "abcd", Result: cloudmigration.MigratedResourceResult{Status: "ok", Message: ""}},
				{Type: "datasource", ID: "2", RefID: "5678", Name: "efgh", Result: cloudmigration.MigratedResourceResult{Status: "error", Message: "db error"}},
			},
			Result:   cloudmigration.MigrationResult{Status: "ok", Message: "nothing"},
			Created:  time.Now(),
			Updated:  time.Now(),
			Finished: time.Now(),
		}

		runRes, err := s.SaveCloudMigrationRun(ctx, run)
		require.NoError(t, err)
		require.NotNil(t, runRes)
		require.Equal(t, 1, runRes.ID)

		value, err := s.GetAllCloudMigrationRuns(ctx)
		require.NoError(t, err)
		require.Equal(t, 1, len(value))
		v := value[0]
		require.Equal(t, int64(1), v.ID)
		require.Equal(t, "cm_uid_123", v.CloudMigrationUID)
		require.Equal(t, 2, len(v.Resources))
		require.NotNil(t, v.Result)
		require.Equal(t, "", v.Result.Message)
		require.Equal(t, "", v.Result.Status)
		// TODO Complete more validations
	})
}
