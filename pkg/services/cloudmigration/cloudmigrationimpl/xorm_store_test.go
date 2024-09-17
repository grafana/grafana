package cloudmigrationimpl

import (
	"context"
	"encoding/base64"
	"slices"
	"strconv"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	fakeSecrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskv "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func Test_GetAllCloudMigrationSessions(t *testing.T) {
	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("get all cloud_migration_session entries", func(t *testing.T) {
		value, err := s.GetCloudMigrationSessionList(ctx)
		require.NoError(t, err)
		require.Equal(t, 3, len(value))
		for _, m := range value {
			switch m.ID {
			case 1:
				require.Equal(t, "11111", m.Slug)
				require.Equal(t, "12345", m.AuthToken)
			case 2:
				require.Equal(t, "22222", m.Slug)
				require.Equal(t, "6789", m.AuthToken)
			case 3:
				require.Equal(t, "33333", m.Slug)
				require.Equal(t, "777", m.AuthToken)
			default:
				require.Fail(t, "ID value not expected: "+strconv.FormatInt(m.ID, 10))
			}
		}
	})
}

func Test_CreateMigrationSession(t *testing.T) {
	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("creates a session and reads it from the db", func(t *testing.T) {
		cm := cloudmigration.CloudMigrationSession{
			AuthToken:   encodeToken("token"),
			Slug:        "fake_stack",
			StackID:     1234,
			RegionSlug:  "fake_slug",
			ClusterSlug: "fake_cluster_slug",
		}
		sess, err := s.CreateMigrationSession(ctx, cm)
		require.NoError(t, err)
		require.NotEmpty(t, sess.ID)
		require.NotEmpty(t, sess.UID)

		getRes, err := s.GetMigrationSessionByUID(ctx, sess.UID)
		require.NoError(t, err)
		require.Equal(t, sess.ID, getRes.ID)
		require.Equal(t, sess.UID, getRes.UID)
		require.Equal(t, cm.AuthToken, getRes.AuthToken)
		require.Equal(t, cm.Slug, getRes.Slug)
		require.Equal(t, cm.StackID, getRes.StackID)
		require.Equal(t, cm.RegionSlug, getRes.RegionSlug)
		require.Equal(t, cm.ClusterSlug, getRes.ClusterSlug)
	})
}

func Test_GetMigrationSessionByUID(t *testing.T) {
	_, s := setUpTest(t)
	ctx := context.Background()
	t.Run("find session by uid", func(t *testing.T) {
		uid := "qwerty"
		mig, err := s.GetMigrationSessionByUID(ctx, uid)
		require.NoError(t, err)
		require.Equal(t, uid, mig.UID)
	})

	t.Run("returns error if session is not found by uid", func(t *testing.T) {
		_, err := s.GetMigrationSessionByUID(ctx, "fake_uid_1234")
		require.ErrorIs(t, cloudmigration.ErrMigrationNotFound, err)
	})
}

/** rewrite this test using the new functions
func Test_DeleteMigrationSession(t *testing.T) {
	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("deletes a session from the db", func(t *testing.T) {
		uid := "qwerty"
		session, snapshots, err := s.DeleteMigrationSessionByUID(ctx, uid)
		require.NoError(t, err)
		require.Equal(t, uid, session.UID)
		require.NotNil(t, snapshots)

		// now we try to find it, should return an error
		_, err = s.GetMigrationSessionByUID(ctx, uid)
		require.ErrorIs(t, cloudmigration.ErrMigrationNotFound, err)
	})
}
*/

func Test_CreateMigrationRun(t *testing.T) {
	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("creates a session run and retrieves it from db", func(t *testing.T) {
		cmr := cloudmigration.CloudMigrationSnapshot{
			SessionUID: "asdfg",
			Status:     cloudmigration.SnapshotStatusFinished,
		}

		createResp, err := s.CreateMigrationRun(ctx, cmr)
		require.NoError(t, err)
		require.NotEmpty(t, createResp)

		getMRResp, err := s.GetMigrationStatus(ctx, createResp)
		require.NoError(t, err)
		require.Equal(t, cmr.Status, getMRResp.Status)
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
	})

	t.Run("returns no error if migration was not found, just empty list", func(t *testing.T) {
		list, err := s.GetMigrationStatusList(ctx, "fake_migration")
		require.NoError(t, err)
		require.Equal(t, 0, len(list))
	})
}

func Test_SnapshotManagement(t *testing.T) {
	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("tests the snapshot lifecycle", func(t *testing.T) {
		session, err := s.CreateMigrationSession(ctx, cloudmigration.CloudMigrationSession{})
		require.NoError(t, err)

		// create a snapshot
		cmr := cloudmigration.CloudMigrationSnapshot{
			SessionUID: session.UID,
			Status:     cloudmigration.SnapshotStatusCreating,
		}

		snapshotUid, err := s.CreateSnapshot(ctx, cmr)
		require.NoError(t, err)
		require.NotEmpty(t, snapshotUid)

		//retrieve it from the db
		snapshot, err := s.GetSnapshotByUID(ctx, session.UID, snapshotUid, 0, 0)
		require.NoError(t, err)
		require.Equal(t, cloudmigration.SnapshotStatusCreating, snapshot.Status)

		// update its status
		err = s.UpdateSnapshot(ctx, cloudmigration.UpdateSnapshotCmd{UID: snapshotUid, Status: cloudmigration.SnapshotStatusCreating, SessionID: session.UID})
		require.NoError(t, err)

		//retrieve it again
		snapshot, err = s.GetSnapshotByUID(ctx, session.UID, snapshotUid, 0, 0)
		require.NoError(t, err)
		require.Equal(t, cloudmigration.SnapshotStatusCreating, snapshot.Status)

		// lists snapshots and ensures it's in there
		snapshots, err := s.GetSnapshotList(ctx, cloudmigration.ListSnapshotsQuery{SessionUID: session.UID, Page: 1, Limit: 100})
		require.NoError(t, err)
		require.Len(t, snapshots, 1)
		require.Equal(t, *snapshot, snapshots[0])

		// delete snapshot
		err = s.DeleteSnapshot(ctx, snapshotUid)
		require.NoError(t, err)

		// now we expect not to find the snapshot
		snapshot, err = s.GetSnapshotByUID(ctx, session.UID, snapshotUid, 0, 0)
		require.ErrorIs(t, err, cloudmigration.ErrSnapshotNotFound)
		require.Nil(t, snapshot)
	})
}

func Test_SnapshotResources(t *testing.T) {
	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("tests CRUD of snapshot resources", func(t *testing.T) {
		// Get the default rows from the test
		resources, err := s.GetSnapshotResources(ctx, "poiuy", 0, 100)
		assert.NoError(t, err)
		assert.Len(t, resources, 3)

		// create a new resource and update an existing resource
		err = s.CreateUpdateSnapshotResources(ctx, "poiuy", []cloudmigration.CloudMigrationResource{
			{
				Type:   cloudmigration.DatasourceDataType,
				RefID:  "mi39fj",
				Status: cloudmigration.ItemStatusOK,
			},
			{
				UID:    "qwerty",
				Status: cloudmigration.ItemStatusOK,
			},
		})
		assert.NoError(t, err)

		// Get resources again
		resources, err = s.GetSnapshotResources(ctx, "poiuy", 0, 100)
		assert.NoError(t, err)
		assert.Len(t, resources, 4)
		// ensure existing resource was updated
		for _, r := range resources {
			if r.UID == "querty" {
				assert.Equal(t, cloudmigration.ItemStatusOK, r.Status)
				break
			}
		}
		// ensure a new one was made
		for _, r := range resources {
			if r.UID == "mi39fj" {
				assert.Equal(t, cloudmigration.ItemStatusOK, r.Status)
				break
			}
		}

		// check stats
		stats, err := s.GetSnapshotResourceStats(ctx, "poiuy")
		assert.NoError(t, err)
		assert.Equal(t, map[cloudmigration.MigrateDataType]int{
			cloudmigration.DatasourceDataType: 2,
			cloudmigration.DashboardDataType:  1,
			cloudmigration.FolderDataType:     1,
		}, stats.CountsByType)
		assert.Equal(t, map[cloudmigration.ItemStatus]int{
			cloudmigration.ItemStatusOK:      3,
			cloudmigration.ItemStatusPending: 1,
		}, stats.CountsByStatus)
		assert.Equal(t, 4, stats.Total)

		// delete snapshot resources
		err = s.DeleteSnapshotResources(ctx, "poiuy")
		assert.NoError(t, err)
		// make sure they're gone
		resources, err = s.GetSnapshotResources(ctx, "poiuy", 0, 100)
		assert.NoError(t, err)
		assert.Len(t, resources, 0)
	})
}

func TestGetSnapshotList(t *testing.T) {
	t.Parallel()

	_, s := setUpTest(t)
	// Taken from setUpTest
	sessionUID := "qwerty"
	ctx := context.Background()

	t.Run("returns list of snapshots that belong to a session", func(t *testing.T) {
		snapshots, err := s.GetSnapshotList(ctx, cloudmigration.ListSnapshotsQuery{SessionUID: sessionUID, Page: 1, Limit: 100})
		require.NoError(t, err)

		ids := make([]string, 0)
		for _, snapshot := range snapshots {
			ids = append(ids, snapshot.UID)
		}
		slices.Sort(ids)

		// There are 3 snapshots in the db but only 2 of them belong to this specific session.
		assert.Equal(t, []string{"lkjhg", "poiuy"}, ids)
	})

	t.Run("only the snapshots that belong to a specific session are returned", func(t *testing.T) {
		snapshots, err := s.GetSnapshotList(ctx, cloudmigration.ListSnapshotsQuery{SessionUID: "session-uid-that-doesnt-exist", Page: 1, Limit: 100})
		require.NoError(t, err)
		assert.Empty(t, snapshots)
	})

	t.Run("if the session is deleted, snapshots can't be retrieved anymore", func(t *testing.T) {
		// Delete the session.
		_, _, err := s.DeleteMigrationSessionByUID(ctx, sessionUID)
		require.NoError(t, err)

		// Fetch the snapshots that belong to the deleted session.
		snapshots, err := s.GetSnapshotList(ctx, cloudmigration.ListSnapshotsQuery{SessionUID: sessionUID, Page: 1, Limit: 100})
		require.NoError(t, err)

		// No snapshots should be returned because the session that
		// they belong to has been deleted.
		assert.Empty(t, snapshots)
	})
}

func TestDecryptToken(t *testing.T) {
	t.Parallel()

	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("with an nil session, it returns a `migration not found` error", func(t *testing.T) {
		t.Parallel()

		var cm *cloudmigration.CloudMigrationSession

		require.ErrorIs(t, s.decryptToken(ctx, cm), cloudmigration.ErrMigrationNotFound)
	})

	t.Run("with an empty auth token, it returns a `token not found` error", func(t *testing.T) {
		t.Parallel()

		var cm cloudmigration.CloudMigrationSession

		require.ErrorIs(t, s.decryptToken(ctx, &cm), cloudmigration.ErrTokenNotFound)
	})

	t.Run("with an invalid base64 auth token, it returns an error", func(t *testing.T) {
		t.Parallel()

		cm := cloudmigration.CloudMigrationSession{
			AuthToken: "invalid-base64-",
		}

		require.Error(t, s.decryptToken(ctx, &cm))
	})

	t.Run("with a valid base64 auth token, it decrypts it and overrides the auth token field", func(t *testing.T) {
		t.Parallel()

		rawAuthToken := "raw-and-fake"
		encodedAuthToken := base64.StdEncoding.EncodeToString([]byte(rawAuthToken))

		cm := cloudmigration.CloudMigrationSession{
			AuthToken: encodedAuthToken,
		}

		require.NoError(t, s.decryptToken(ctx, &cm))
		require.Equal(t, rawAuthToken, cm.AuthToken)
	})
}

func setUpTest(t *testing.T) (*sqlstore.SQLStore, *sqlStore) {
	testDB := db.InitTestDB(t)
	s := &sqlStore{
		db:             testDB,
		secretsService: fakeSecrets.FakeSecretsService{},
		secretsStore:   secretskv.NewFakeSQLSecretsKVStore(t),
	}
	ctx := context.Background()

	// insert cloud migration test data
	_, err := testDB.GetSqlxSession().Exec(ctx, `
		INSERT INTO
			cloud_migration_session (id, uid, auth_token, slug, stack_id, region_slug, cluster_slug, created, updated)
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
			cloud_migration_snapshot (session_uid, uid, created, updated, finished, status)
		VALUES
			('qwerty', 'poiuy', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000', '2024-03-27 15:30:43.000', "finished"),
			('qwerty', 'lkjhg', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000', '2024-03-27 15:30:43.000', "finished"),
			('zxcvbn', 'mnbvvc', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000', '2024-03-27 15:30:43.000', "finished");
		`,
	)
	require.NoError(t, err)

	// Store encryption keys used to encrypt/decrypt snapshots.
	for _, snapshotUid := range []string{"poiuy", "lkjhg", "mnbvvc"} {
		err = s.secretsStore.Set(ctx, secretskv.AllOrganizations, snapshotUid, secretType, "encryption_key")
		require.NoError(t, err)
	}

	_, err = testDB.GetSqlxSession().Exec(ctx, `
		INSERT INTO
			cloud_migration_resource (uid, snapshot_uid, resource_type, resource_uid, status, error_string)
		VALUES
			('mnbvde', 'poiuy', 'DATASOURCE', 'jf38gh', 'OK', ''),
			('qwerty', 'poiuy', 'DASHBOARD', 'ejcx4d', 'ERROR', 'fake error'),
			('zxcvbn', 'poiuy', 'FOLDER', 'fi39fj', 'PENDING', ''),
			('4fi9sd', '39fi39', 'FOLDER', 'fi39fj', 'OK', '');
		`,
	)
	require.NoError(t, err)

	return testDB, s
}

func encodeToken(t string) string {
	return base64.StdEncoding.EncodeToString([]byte(t))
}
