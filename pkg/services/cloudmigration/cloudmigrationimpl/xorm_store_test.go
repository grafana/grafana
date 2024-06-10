package cloudmigrationimpl

import (
	"context"
	"encoding/base64"
	"strconv"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	fakeSecrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func Test_GetAllCloudMigrations(t *testing.T) {
	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("get all cloud_migrations", func(t *testing.T) {
		value, err := s.GetAllCloudMigrations(ctx)
		require.NoError(t, err)
		require.Equal(t, 3, len(value))
		for _, m := range value {
			switch m.ID {
			case 1:
				require.Equal(t, "11111", m.Stack)
				require.Equal(t, "12345", m.AuthToken)
			case 2:
				require.Equal(t, "22222", m.Stack)
				require.Equal(t, "6789", m.AuthToken)
			case 3:
				require.Equal(t, "33333", m.Stack)
				require.Equal(t, "777", m.AuthToken)
			default:
				require.Fail(t, "ID value not expected: "+strconv.FormatInt(m.ID, 10))
			}
		}
	})
}

func Test_CreateMigration(t *testing.T) {
	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("creates migrations and reads it from the db", func(t *testing.T) {
		cm := cloudmigration.CloudMigration{
			AuthToken:   encodeToken("token"),
			Stack:       "fake_stack",
			StackID:     1234,
			RegionSlug:  "fake_slug",
			ClusterSlug: "fake_cluster_slug",
		}
		mig, err := s.CreateMigration(ctx, cm)
		require.NoError(t, err)
		require.NotEmpty(t, mig.ID)
		require.NotEmpty(t, mig.UID)

		getRes, err := s.GetMigrationByUID(ctx, mig.UID)
		require.NoError(t, err)
		require.Equal(t, mig.ID, getRes.ID)
		require.Equal(t, mig.UID, getRes.UID)
		require.Equal(t, cm.AuthToken, getRes.AuthToken)
		require.Equal(t, cm.Stack, getRes.Stack)
		require.Equal(t, cm.StackID, getRes.StackID)
		require.Equal(t, cm.RegionSlug, getRes.RegionSlug)
		require.Equal(t, cm.ClusterSlug, getRes.ClusterSlug)
	})
}

func Test_GetMigrationByUID(t *testing.T) {
	_, s := setUpTest(t)
	ctx := context.Background()
	t.Run("find migration by uid", func(t *testing.T) {
		uid := "qwerty"
		mig, err := s.GetMigrationByUID(ctx, uid)
		require.NoError(t, err)
		require.Equal(t, uid, mig.UID)
	})

	t.Run("returns error if migration is not found by uid", func(t *testing.T) {
		_, err := s.GetMigrationByUID(ctx, "fake_uid_1234")
		require.ErrorIs(t, cloudmigration.ErrMigrationNotFound, err)
	})
}

func Test_DeleteMigration(t *testing.T) {
	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("deletes a migration from the db", func(t *testing.T) {
		uid := "qwerty"
		delResp, err := s.DeleteMigration(ctx, uid)
		require.NoError(t, err)
		require.Equal(t, uid, delResp.UID)

		// now we try to find it, should return an error
		_, err = s.GetMigrationByUID(ctx, uid)
		require.ErrorIs(t, cloudmigration.ErrMigrationNotFound, err)
	})
}

func Test_CreateMigrationRun(t *testing.T) {
	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("creates a migration run and retrieves it from db", func(t *testing.T) {
		result := []byte("OK")
		cmr := cloudmigration.CloudMigrationRun{
			CloudMigrationUID: "asdfg",
			Result:            result,
		}

		createResp, err := s.CreateMigrationRun(ctx, cmr)
		require.NoError(t, err)
		require.NotEmpty(t, createResp)

		getMRResp, err := s.GetMigrationStatus(ctx, createResp)
		require.NoError(t, err)
		require.Equal(t, result, getMRResp.Result)
	})
}

func Test_GetMigrationStatus(t *testing.T) {
	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("gets a migration status by uid", func(t *testing.T) {
		getMRResp, err := s.GetMigrationStatus(ctx, "poiuy")
		require.NoError(t, err)
		require.Equal(t, "poiuy", getMRResp.UID)
	})

	t.Run("returns error if migration run was not found", func(t *testing.T) {
		getMRResp, err := s.GetMigrationStatus(ctx, "fake_uid")
		require.ErrorIs(t, cloudmigration.ErrMigrationRunNotFound, err)
		require.Equal(t, int64(0), getMRResp.ID)
		require.Equal(t, "", getMRResp.UID)
	})
}

func Test_GetMigrationStatusList(t *testing.T) {
	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("gets migration status list from db", func(t *testing.T) {
		list, err := s.GetMigrationStatusList(ctx, "qwerty")
		require.NoError(t, err)
		require.Equal(t, 2, len(list))
		// TODO validate that this is ok
	})

	t.Run("returns no error if migration was not found, just empty list", func(t *testing.T) {
		list, err := s.GetMigrationStatusList(ctx, "fake_migration")
		require.NoError(t, err)
		require.Equal(t, 0, len(list))
	})
}

func setUpTest(t *testing.T) (*sqlstore.SQLStore, *sqlStore) {
	testDB := db.InitTestDB(t)
	s := &sqlStore{
		db:             testDB,
		secretsService: fakeSecrets.FakeSecretsService{},
	}
	ctx := context.Background()

	// insert cloud migration test data
	_, err := testDB.GetSqlxSession().Exec(ctx, `
 			INSERT INTO
 			    cloud_migration (id, uid, auth_token, stack, stack_id, region_slug, cluster_slug, created, updated)
 			VALUES
 			    (1,'qwerty', ?, '11111', 11111, 'test', 'test', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000'),
  				(2,'asdfgh', ?, '22222', 22222, 'test', 'test', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000'),
  				(3,'zxcvbn', ?, '33333', 33333, 'test', 'test', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000');
 		`,
		encodeToken("12345"),
		encodeToken("6789"),
		encodeToken("777"),
	)
	require.NoError(t, err)

	// insert cloud migration run test data
	_, err = testDB.GetSqlxSession().Exec(ctx, `
 			INSERT INTO
 			    cloud_migration_run (cloud_migration_uid, uid, result, created, updated, finished)
 			VALUES
 			    ('qwerty', 'poiuy', ?, '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000', '2024-03-27 15:30:43.000'),
  				('qwerty', 'lkjhg', ?, '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000', '2024-03-27 15:30:43.000'),
  				('zxcvbn', 'mnbvvc', ?, '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000', '2024-03-27 15:30:43.000');
 		`,
		[]byte("ERROR"),
		[]byte("OK"),
		[]byte("OK"),
	)
	require.NoError(t, err)

	return testDB, s
}

func encodeToken(t string) string {
	return base64.StdEncoding.EncodeToString([]byte(t))
}
