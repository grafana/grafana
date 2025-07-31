package cloudmigrationimpl

import (
	"bytes"
	"context"
	cryptoRand "crypto/rand"
	"encoding/base64"
	"fmt"
	"strconv"
	"testing"

	"github.com/google/uuid"
	snapshot "github.com/grafana/grafana-cloud-migration-snapshot/src"
	"github.com/grafana/grafana-cloud-migration-snapshot/src/contracts"
	"github.com/grafana/grafana-cloud-migration-snapshot/src/infra/crypto"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	fakeSecrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskv "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/nacl/box"
)

func Test_GetAllCloudMigrationSessions(t *testing.T) {
	t.Parallel()

	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("get all cloud_migration_session entries", func(t *testing.T) {
		value, err := s.GetCloudMigrationSessionList(ctx, 1)
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
	t.Parallel()

	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("creates a session and reads it from the db", func(t *testing.T) {
		cm := cloudmigration.CloudMigrationSession{
			AuthToken:   encodeToken("token"),
			Slug:        "fake_stack",
			OrgID:       3,
			StackID:     1234,
			RegionSlug:  "fake_slug",
			ClusterSlug: "fake_cluster_slug",
		}
		sess, err := s.CreateMigrationSession(ctx, cm)
		require.NoError(t, err)
		require.NotEmpty(t, sess.ID)
		require.NotEmpty(t, sess.UID)

		getRes, err := s.GetMigrationSessionByUID(ctx, 3, sess.UID)
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
	t.Parallel()

	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("find session by uid", func(t *testing.T) {
		uid := "qwerty"
		orgId := int64(1)
		mig, err := s.GetMigrationSessionByUID(ctx, orgId, uid)
		require.NoError(t, err)
		require.Equal(t, uid, mig.UID)
		require.Equal(t, orgId, mig.OrgID)
	})

	t.Run("returns error if session is not found by uid", func(t *testing.T) {
		_, err := s.GetMigrationSessionByUID(ctx, 1, "fake_uid_1234")
		require.ErrorIs(t, cloudmigration.ErrMigrationNotFound, err)
	})
}

func Test_SnapshotManagement(t *testing.T) {
	t.Parallel()

	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("tests the snapshot lifecycle", func(t *testing.T) {
		session, err := s.CreateMigrationSession(ctx, cloudmigration.CloudMigrationSession{
			OrgID:     1,
			AuthToken: encodeToken("token"),
		})
		require.NoError(t, err)

		// create a snapshot
		uid := uuid.NewString()
		cmr := cloudmigration.CloudMigrationSnapshot{
			UID:        uid,
			SessionUID: session.UID,
			Status:     cloudmigration.SnapshotStatusCreating,
		}

		err = s.CreateSnapshot(ctx, cmr)
		require.NoError(t, err)

		//retrieve it from the db
		snapshot, err := s.GetSnapshotByUID(ctx, 1, session.UID, uid, cloudmigration.SnapshotResultQueryParams{
			ResultPage:  1,
			ResultLimit: 100,
			SortColumn:  cloudmigration.SortColumnID,
			SortOrder:   cloudmigration.SortOrderAsc,
		})
		require.NoError(t, err)
		require.Equal(t, cloudmigration.SnapshotStatusCreating, snapshot.Status)

		// update its status
		err = s.UpdateSnapshot(ctx, cloudmigration.UpdateSnapshotCmd{UID: uid, Status: cloudmigration.SnapshotStatusCreating, SessionID: session.UID})
		require.NoError(t, err)

		//retrieve it again
		snapshot, err = s.GetSnapshotByUID(ctx, 1, session.UID, uid, cloudmigration.SnapshotResultQueryParams{
			ResultPage:  1,
			ResultLimit: 100,
			SortColumn:  cloudmigration.SortColumnID,
			SortOrder:   cloudmigration.SortOrderAsc,
		})
		require.NoError(t, err)
		require.Equal(t, cloudmigration.SnapshotStatusCreating, snapshot.Status)

		// lists snapshots and ensures it's in there
		snapshots, err := s.GetSnapshotList(ctx, cloudmigration.ListSnapshotsQuery{SessionUID: session.UID, OrgID: 1, Page: 1, Limit: 100})
		require.NoError(t, err)
		require.Len(t, snapshots, 1)
		require.Equal(t, *snapshot, snapshots[0])

		// delete snapshot
		err = s.deleteSnapshot(ctx, uid)
		require.NoError(t, err)

		// now we expect not to find the snapshot
		snapshot, err = s.GetSnapshotByUID(ctx, 1, session.UID, uid, cloudmigration.SnapshotResultQueryParams{
			ResultPage:  1,
			ResultLimit: 100,
			SortColumn:  cloudmigration.SortColumnID,
			SortOrder:   cloudmigration.SortOrderAsc,
		})
		require.ErrorIs(t, err, cloudmigration.ErrSnapshotNotFound)
		require.Nil(t, snapshot)
	})

	t.Run("tests a snapshot with a large number of resources", func(t *testing.T) {
		session, err := s.CreateMigrationSession(ctx, cloudmigration.CloudMigrationSession{
			OrgID:     1,
			AuthToken: encodeToken("token"),
		})
		require.NoError(t, err)

		// create a snapshot
		uid := uuid.NewString()
		err = s.CreateSnapshot(ctx, cloudmigration.CloudMigrationSnapshot{
			UID:        uid,
			SessionUID: session.UID,
			Status:     cloudmigration.SnapshotStatusCreating,
		})
		require.NoError(t, err)

		// Generate 50,001 test resources in order to test both update conditions (reached the batch limit or reached the end)
		const numResources = 50001
		resources := make([]cloudmigration.CloudMigrationResource, numResources)

		for i := 0; i < numResources; i++ {
			resources[i] = cloudmigration.CloudMigrationResource{
				Name:   fmt.Sprintf("Resource %d", i),
				Type:   cloudmigration.DashboardDataType,
				RefID:  fmt.Sprintf("refid-%d", i),
				Status: cloudmigration.ItemStatusPending,
			}
		}

		// Update the snapshot with the resources to create
		err = s.UpdateSnapshot(ctx, cloudmigration.UpdateSnapshotCmd{
			UID:                    uid,
			Status:                 cloudmigration.SnapshotStatusPendingUpload,
			SessionID:              session.UID,
			LocalResourcesToCreate: resources,
		})
		require.NoError(t, err)

		// Get the Snapshot and ensure it's in the right state
		snapshot, err := s.GetSnapshotByUID(ctx, 1, session.UID, uid, cloudmigration.SnapshotResultQueryParams{
			ResultPage:  1,
			ResultLimit: numResources,
			SortColumn:  cloudmigration.SortColumnID,
			SortOrder:   cloudmigration.SortOrderAsc,
		})
		require.NoError(t, err)
		require.Equal(t, cloudmigration.SnapshotStatusPendingUpload, snapshot.Status)
		require.Len(t, snapshot.Resources, numResources)

		for i, r := range snapshot.Resources {
			assert.Equal(t, cloudmigration.ItemStatusPending, r.Status)

			if i%2 == 0 {
				snapshot.Resources[i].Status = cloudmigration.ItemStatusOK
			} else {
				snapshot.Resources[i].Status = cloudmigration.ItemStatusError
			}
		}

		// Update the snapshot with the resources to update
		err = s.UpdateSnapshot(ctx, cloudmigration.UpdateSnapshotCmd{
			UID:                    uid,
			Status:                 cloudmigration.SnapshotStatusFinished,
			SessionID:              session.UID,
			CloudResourcesToUpdate: snapshot.Resources,
		})
		require.NoError(t, err)

		// Get the Snapshot and ensure it's in the right state
		snapshot, err = s.GetSnapshotByUID(ctx, 1, session.UID, uid, cloudmigration.SnapshotResultQueryParams{
			ResultPage:  1,
			ResultLimit: numResources,
			SortColumn:  cloudmigration.SortColumnID,
			SortOrder:   cloudmigration.SortOrderAsc,
		})
		require.NoError(t, err)
		require.Equal(t, cloudmigration.SnapshotStatusFinished, snapshot.Status)

		for i, r := range snapshot.Resources {
			if i%2 == 0 {
				assert.Equal(t, cloudmigration.ItemStatusOK, r.Status)
			} else {
				assert.Equal(t, cloudmigration.ItemStatusError, r.Status)
			}
		}
	})
}

func Test_SnapshotResources(t *testing.T) {
	t.Parallel()

	_, s := setUpTest(t)
	ctx := context.Background()

	t.Run("test CRUD of snapshot resources", func(t *testing.T) {
		// Get the default rows from the test
		resources, err := s.getSnapshotResources(ctx, "poiuy", cloudmigration.SnapshotResultQueryParams{
			ResultPage:  1,
			ResultLimit: 100,
			SortColumn:  cloudmigration.SortColumnID,
			SortOrder:   cloudmigration.SortOrderAsc,
		})
		assert.NoError(t, err)
		assert.Len(t, resources, 3)
		for _, r := range resources {
			if r.RefID == "ejcx4d" {
				assert.Equal(t, cloudmigration.ItemStatusError, r.Status)
				break
			}
		}

		// create a new resource
		err = s.CreateSnapshotResources(ctx, "poiuy", []cloudmigration.CloudMigrationResource{
			{
				Type:   cloudmigration.DatasourceDataType,
				RefID:  "mi39fj",
				Status: cloudmigration.ItemStatusOK,
			},
		})
		assert.NoError(t, err)
		err = s.UpdateSnapshotResources(ctx, "poiuy", []cloudmigration.CloudMigrationResource{
			{
				RefID:  "ejcx4d",
				Status: cloudmigration.ItemStatusOK,
			},
		})
		assert.NoError(t, err)

		// Get resources again
		resources, err = s.getSnapshotResources(ctx, "poiuy", cloudmigration.SnapshotResultQueryParams{
			ResultPage:  1,
			ResultLimit: 100,
			SortColumn:  cloudmigration.SortColumnID,
			SortOrder:   cloudmigration.SortOrderAsc,
		})
		assert.NoError(t, err)
		assert.Len(t, resources, 4)
		// ensure existing resource was updated from ERROR
		for _, r := range resources {
			if r.RefID == "ejcx4d" {
				assert.Equal(t, cloudmigration.ItemStatusOK, r.Status)
				break
			}
		}
		// ensure a new one was made
		for _, r := range resources {
			if r.RefID == "mi39fj" {
				assert.Equal(t, cloudmigration.ItemStatusOK, r.Status)
				break
			}
		}

		// check stats
		stats, err := s.getSnapshotResourceStats(ctx, "poiuy")
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
		err = s.deleteSnapshotResources(ctx, "poiuy")
		assert.NoError(t, err)
		// make sure they're gone
		resources, err = s.getSnapshotResources(ctx, "poiuy", cloudmigration.SnapshotResultQueryParams{
			ResultPage:  1,
			ResultLimit: 100,
			SortColumn:  cloudmigration.SortColumnID,
			SortOrder:   cloudmigration.SortOrderAsc,
		})
		assert.NoError(t, err)
		assert.Len(t, resources, 0)
	})

	t.Run("test pagination and sorting", func(t *testing.T) {
		// Create test data
		resources := []cloudmigration.CloudMigrationResource{
			{UID: "1", SnapshotUID: "abc123", Name: "Dashboard 1", Type: cloudmigration.DashboardDataType, Status: cloudmigration.ItemStatusOK},
			{UID: "2", SnapshotUID: "abc123", Name: "Alert 1", Type: cloudmigration.AlertRuleType, Status: cloudmigration.ItemStatusError},
			{UID: "3", SnapshotUID: "abc123", Name: "Dashboard 2", Type: cloudmigration.DashboardDataType, Status: cloudmigration.ItemStatusPending},
			{UID: "4", SnapshotUID: "abc123", Name: "Folder 1", Type: cloudmigration.FolderDataType, Status: cloudmigration.ItemStatusOK},
			{UID: "5", SnapshotUID: "abc123", Name: "Alert 2", Type: cloudmigration.AlertRuleType, Status: cloudmigration.ItemStatusOK},
		}

		err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Insert(resources)
			return err
		})
		require.NoError(t, err)

		t.Run("default sorting and paging and default params", func(t *testing.T) {
			results, err := s.getSnapshotResources(ctx, "abc123", cloudmigration.SnapshotResultQueryParams{
				ResultPage:  1,
				ResultLimit: 100,
				SortColumn:  cloudmigration.SortColumnID,
				SortOrder:   cloudmigration.SortOrderAsc,
			})
			require.NoError(t, err)
			assert.Len(t, results, 5)
			// Default sort is by ID ascending
			assert.Equal(t, "1", results[0].UID)
			assert.Equal(t, "5", results[4].UID)
		})

		t.Run("sort by name descending", func(t *testing.T) {
			results, err := s.getSnapshotResources(ctx, "abc123", cloudmigration.SnapshotResultQueryParams{
				ResultPage:  1,
				ResultLimit: 100,
				SortColumn:  cloudmigration.SortColumnName,
				SortOrder:   cloudmigration.SortOrderDesc,
			})
			require.NoError(t, err)
			assert.Equal(t, "Folder 1", results[0].Name)
			assert.Equal(t, "Alert 1", results[4].Name)
		})

		t.Run("sort by type ascending", func(t *testing.T) {
			results, err := s.getSnapshotResources(ctx, "abc123", cloudmigration.SnapshotResultQueryParams{
				ResultPage:  1,
				ResultLimit: 100,
				SortColumn:  cloudmigration.SortColumnType,
				SortOrder:   cloudmigration.SortOrderAsc,
			})
			require.NoError(t, err)
			assert.Equal(t, "2", results[0].UID)
			assert.Equal(t, "5", results[1].UID)
		})

		t.Run("sort by status with pagination", func(t *testing.T) {
			results, err := s.getSnapshotResources(ctx, "abc123", cloudmigration.SnapshotResultQueryParams{
				ResultPage:  2,
				ResultLimit: 2,
				SortColumn:  cloudmigration.SortColumnStatus,
				SortOrder:   cloudmigration.SortOrderAsc,
			})
			require.NoError(t, err)
			assert.Len(t, results, 2)
			// secondary sort is by ID ascending by default
			assert.Equal(t, "4", results[0].UID)
			assert.Equal(t, "5", results[1].UID)
		})

		t.Run("only errors filter returns only error status resources", func(t *testing.T) {
			results, err := s.getSnapshotResources(ctx, "abc123", cloudmigration.SnapshotResultQueryParams{
				ResultPage:  1,
				ResultLimit: 100,
				SortColumn:  cloudmigration.SortColumnID,
				SortOrder:   cloudmigration.SortOrderAsc,
				ErrorsOnly:  true,
			})
			require.NoError(t, err)
			assert.Len(t, results, 1)
			assert.Equal(t, "2", results[0].UID)
		})
	})

	t.Run("test creating and updating a large number of resources", func(t *testing.T) {
		// Generate 50,001 test resources in order to test both update conditions (reached the batch limit or reached the end)
		const numResources = 50001
		resources := make([]cloudmigration.CloudMigrationResource, numResources)
		snapshotUid := uuid.New().String()

		t.Run("create the resources", func(t *testing.T) {
			for i := 0; i < numResources; i++ {
				resources[i] = cloudmigration.CloudMigrationResource{
					Name:   fmt.Sprintf("Resource %d", i),
					Type:   cloudmigration.DashboardDataType,
					RefID:  fmt.Sprintf("refid-%d", i),
					Status: cloudmigration.ItemStatusPending,
				}
			}

			// Attempt to create all resources at once -- it should batch under the hood
			err := s.CreateSnapshotResources(ctx, snapshotUid, resources)
			require.NoError(t, err)

			// Get the resources and ensure they're all there
			resources, err := s.getSnapshotResources(ctx, snapshotUid, cloudmigration.SnapshotResultQueryParams{
				ResultPage:  1,
				ResultLimit: numResources,
				SortColumn:  cloudmigration.SortColumnID,
				SortOrder:   cloudmigration.SortOrderAsc,
			})
			require.NoError(t, err)
			assert.Len(t, resources, numResources)
		})

		t.Run("update the resources", func(t *testing.T) {
			// Initially, update with a mix of ok and error statuses
			for i := 0; i < numResources; i++ {
				if i%2 == 0 {
					resources[i].Status = cloudmigration.ItemStatusOK
				} else {
					resources[i].Status = cloudmigration.ItemStatusError
					resources[i].ErrorCode = "test-error"
					resources[i].Error = "test-error-message"
				}
			}

			err := s.UpdateSnapshotResources(ctx, snapshotUid, resources)
			require.NoError(t, err)

			resources, err := s.getSnapshotResources(ctx, snapshotUid, cloudmigration.SnapshotResultQueryParams{
				ResultPage:  1,
				ResultLimit: numResources,
				SortColumn:  cloudmigration.SortColumnID,
				SortOrder:   cloudmigration.SortOrderAsc,
			})
			require.NoError(t, err)
			assert.Len(t, resources, numResources)
			for i, r := range resources {
				if i%2 == 0 {
					assert.Equal(t, cloudmigration.ItemStatusOK, r.Status)
				} else {
					assert.Equal(t, cloudmigration.ItemStatusError, r.Status)
					assert.Equal(t, "test-error", string(r.ErrorCode))
					assert.Equal(t, "test-error-message", r.Error)
				}
			}

			// Now update with only error statuses
			for i := 0; i < numResources; i++ {
				resources[i].Status = cloudmigration.ItemStatusError
				resources[i].ErrorCode = "test-error-2"
				resources[i].Error = "test-error-message-2"
			}

			err = s.UpdateSnapshotResources(ctx, snapshotUid, resources)
			require.NoError(t, err)

			resources, err = s.getSnapshotResources(ctx, snapshotUid, cloudmigration.SnapshotResultQueryParams{
				ResultPage:  1,
				ResultLimit: numResources,
				SortColumn:  cloudmigration.SortColumnID,
				SortOrder:   cloudmigration.SortOrderAsc,
			})
			require.NoError(t, err)
			assert.Len(t, resources, numResources)
			for _, r := range resources {
				assert.Equal(t, cloudmigration.ItemStatusError, r.Status)
				assert.Equal(t, "test-error-2", string(r.ErrorCode))
				assert.Equal(t, "test-error-message-2", r.Error)
			}

			// Finally, all okay
			for i := 0; i < numResources; i++ {
				resources[i].Status = cloudmigration.ItemStatusOK
			}

			err = s.UpdateSnapshotResources(ctx, snapshotUid, resources)
			require.NoError(t, err)

			resources, err = s.getSnapshotResources(ctx, snapshotUid, cloudmigration.SnapshotResultQueryParams{
				ResultPage:  1,
				ResultLimit: numResources,
				SortColumn:  cloudmigration.SortColumnID,
				SortOrder:   cloudmigration.SortOrderAsc,
			})
			require.NoError(t, err)
			assert.Len(t, resources, numResources)
			for _, r := range resources {
				assert.Equal(t, cloudmigration.ItemStatusOK, r.Status)
			}
		})
	})
}

func Test_SnapshotResourceCaseInsensitiveSorting(t *testing.T) {
	t.Parallel()

	_, s := setUpTest(t)
	ctx := context.Background()

	// Create test data with mixed case names
	resources := []cloudmigration.CloudMigrationResource{
		{UID: "1", SnapshotUID: "abc123", Name: "B", Type: cloudmigration.DashboardDataType, Status: cloudmigration.ItemStatusOK},
		{UID: "2", SnapshotUID: "abc123", Name: "aa", Type: cloudmigration.AlertRuleType, Status: cloudmigration.ItemStatusOK},
		{UID: "3", SnapshotUID: "abc123", Name: "ba", Type: cloudmigration.DashboardDataType, Status: cloudmigration.ItemStatusOK},
		{UID: "4", SnapshotUID: "abc123", Name: "A", Type: cloudmigration.AlertRuleType, Status: cloudmigration.ItemStatusOK},
	}

	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Insert(resources)
		return err
	})
	require.NoError(t, err)

	// Test ascending sort
	results, err := s.getSnapshotResources(ctx, "abc123", cloudmigration.SnapshotResultQueryParams{
		ResultPage:  1,
		ResultLimit: 100,
		SortColumn:  cloudmigration.SortColumnName,
		SortOrder:   cloudmigration.SortOrderAsc,
	})
	require.NoError(t, err)
	assert.True(t, testNameComesBefore(t, results, "A", "aa"))
	assert.True(t, testNameComesBefore(t, results, "B", "ba"))
	assert.True(t, testNameComesBefore(t, results, "A", "B"))
	assert.True(t, testNameComesBefore(t, results, "aa", "B"))
	assert.True(t, testNameComesBefore(t, results, "aa", "ba"))
	assert.True(t, testNameComesBefore(t, results, "A", "ba"))
	assert.True(t, testNameComesBefore(t, results, "A", "B"))

	// Test descending sort
	results, err = s.getSnapshotResources(ctx, "abc123", cloudmigration.SnapshotResultQueryParams{
		ResultPage:  1,
		ResultLimit: 100,
		SortColumn:  cloudmigration.SortColumnName,
		SortOrder:   cloudmigration.SortOrderDesc,
	})
	require.NoError(t, err)
	assert.True(t, testNameComesBefore(t, results, "ba", "B"))
	assert.True(t, testNameComesBefore(t, results, "aa", "A"))
	assert.True(t, testNameComesBefore(t, results, "ba", "B"))
	assert.True(t, testNameComesBefore(t, results, "aa", "A"))
	assert.True(t, testNameComesBefore(t, results, "ba", "B"))
	assert.True(t, testNameComesBefore(t, results, "aa", "A"))
}

func testNameComesBefore(t *testing.T, input []cloudmigration.CloudMigrationResource, first string, second string) bool {
	t.Helper()

	foundFirst, foundSecond := false, false
	for _, r := range input {
		if r.Name == second {
			foundSecond = true
			continue
		}
		if r.Name == first {
			if foundSecond {
				return false
			}
			foundFirst = true
		}
	}
	return foundFirst && foundSecond
}

func TestGetSnapshotList(t *testing.T) {
	t.Parallel()

	_, s := setUpTest(t)
	// Taken from setUpTest
	sessionUID := "qwerty"
	ctx := context.Background()

	t.Run("returns list of snapshots that belong to a session", func(t *testing.T) {
		snapshots, err := s.GetSnapshotList(ctx, cloudmigration.ListSnapshotsQuery{SessionUID: sessionUID, OrgID: 1, Page: 1, Limit: 100})
		require.NoError(t, err)

		ids := make([]string, 0)
		for _, snapshot := range snapshots {
			ids = append(ids, snapshot.UID)
		}

		// There are 3 snapshots in the db but only 2 of them belong to this specific session.
		assert.Equal(t, []string{"poiuy", "lkjhg"}, ids)
	})

	t.Run("returns only one snapshot that belongs to a session", func(t *testing.T) {
		snapshots, err := s.GetSnapshotList(ctx, cloudmigration.ListSnapshotsQuery{SessionUID: sessionUID, OrgID: 1, Page: 1, Limit: 1})
		require.NoError(t, err)
		assert.Len(t, snapshots, 1)
	})

	t.Run("return no snapshots if limit is set to 0", func(t *testing.T) {
		snapshots, err := s.GetSnapshotList(ctx, cloudmigration.ListSnapshotsQuery{SessionUID: sessionUID, OrgID: 1, Page: 1, Limit: 0})
		require.NoError(t, err)
		assert.Empty(t, snapshots)
	})

	t.Run("returns paginated snapshot that belongs to a session", func(t *testing.T) {
		snapshots, err := s.GetSnapshotList(ctx, cloudmigration.ListSnapshotsQuery{SessionUID: sessionUID, OrgID: 1, Page: 2, Limit: 1})
		require.NoError(t, err)

		ids := make([]string, 0)
		for _, snapshot := range snapshots {
			ids = append(ids, snapshot.UID)
		}

		// Return paginated snapshot of the 2 belonging to this specific session
		assert.Equal(t, []string{"lkjhg"}, ids)
	})

	t.Run("returns desc sorted list of snapshots that belong to a session", func(t *testing.T) {
		snapshots, err := s.GetSnapshotList(ctx, cloudmigration.ListSnapshotsQuery{SessionUID: sessionUID, OrgID: 1, Page: 1, Limit: 100, Sort: "latest"})
		require.NoError(t, err)

		ids := make([]string, 0)
		for _, snapshot := range snapshots {
			ids = append(ids, snapshot.UID)
		}

		// Return desc sorted snapshots belonging to this specific session
		assert.Equal(t, []string{"lkjhg", "poiuy"}, ids)
	})

	t.Run("only the snapshots that belong to a specific session are returned", func(t *testing.T) {
		snapshots, err := s.GetSnapshotList(ctx, cloudmigration.ListSnapshotsQuery{SessionUID: "session-uid-that-doesnt-exist", OrgID: 1, Page: 1, Limit: 100})
		require.NoError(t, err)
		assert.Empty(t, snapshots)
	})

	t.Run("if the session is deleted, snapshots can't be retrieved anymore", func(t *testing.T) {
		// Delete the session.
		_, _, err := s.DeleteMigrationSessionByUID(ctx, 1, sessionUID)
		require.NoError(t, err)

		// Fetch the snapshots that belong to the deleted session.
		snapshots, err := s.GetSnapshotList(ctx, cloudmigration.ListSnapshotsQuery{SessionUID: sessionUID, OrgID: 1, Page: 1, Limit: 100})
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
	testDB := sqlstore.NewTestStore(t)

	s := &sqlStore{
		db:             testDB,
		secretsService: fakeSecrets.FakeSecretsService{},
		secretsStore:   secretskv.NewFakeSQLSecretsKVStore(t, testDB),
	}
	ctx := context.Background()

	// insert cloud migration test data
	_, err := testDB.GetSqlxSession().Exec(ctx, `
		INSERT INTO
			cloud_migration_session (uid, org_id, auth_token, slug, stack_id, region_slug, cluster_slug, created, updated)
		VALUES
			('qwerty', 1, ?, '11111', 11111, 'test', 'test', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000'),
			('asdfgh', 1, ?, '22222', 22222, 'test', 'test', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000'),
			('zxcvbn', 1, ?, '33333', 33333, 'test', 'test', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000'),
			('zxcvbn_org2', 2, ?, '33333', 33333, 'test', 'test', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000');
 		`,
		encodeToken("12345"),
		encodeToken("6789"),
		encodeToken("777"),
		encodeToken("0987"),
	)
	require.NoError(t, err)

	// insert cloud migration run test data
	_, err = testDB.GetSqlxSession().Exec(ctx, `
		INSERT INTO
			cloud_migration_snapshot (session_uid, uid, created, updated, status)
		VALUES
			('qwerty', 'poiuy',  '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000', 'finished'),
			('qwerty', 'lkjhg', '2024-03-26 15:30:36.000', '2024-03-27 15:30:43.000', 'finished'),
			('zxcvbn', 'mnbvvc', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000', 'finished'),
			('zxcvbn_org2', 'mnbvvc_org2', '2024-03-25 15:30:36.000', '2024-03-27 15:30:43.000', 'finished');
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
			('4fi9sd', '39fi39', 'FOLDER', 'fi39fj', 'OK', ''),
			('4fi9ee', 'mnbvvc_org2', 'DATASOURCE', 'fi39asd', 'OK', '');
		`,
	)
	require.NoError(t, err)

	return testDB, s
}

func encodeToken(t string) string {
	return base64.StdEncoding.EncodeToString([]byte(t))
}

func TestEncodeDecode(t *testing.T) {
	gmsPublicKey, gmsPrivateKey, err := box.GenerateKey(cryptoRand.Reader)
	require.NoError(t, err)

	grafanaPublicKey, grafanaPrivateKey, err := box.GenerateKey(cryptoRand.Reader)
	require.NoError(t, err)

	snapshotWriter, err := snapshot.NewSnapshotWriter(contracts.AssymetricKeys{
		Public:  gmsPublicKey[:],
		Private: grafanaPrivateKey[:],
	},
		crypto.NewNacl(),
		"",
	)
	require.NoError(t, err)

	chunk := []snapshot.MigrateDataRequestItemDTO{{
		Type:  snapshot.AlertRuleGroupType,
		RefID: "foo",
		Name:  "name",
		Data:  map[string]any{"a": "b"},
	}}
	encoded, err := snapshotWriter.EncodePartition(chunk)
	require.NoError(t, err)

	require.NoError(t, snapshotWriter.Write("RESOURCE_TYPE", chunk))

	reader := snapshot.NewSnapshotReader(contracts.AssymetricKeys{
		Public:  grafanaPublicKey[:],
		Private: gmsPrivateKey[:],
	},
		crypto.NewNacl())

	partition, err := reader.ReadFile(bytes.NewReader(encoded))
	require.NoError(t, err)

	require.Equal(t, chunk, partition.Items)
}
