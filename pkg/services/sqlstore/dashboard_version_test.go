//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func updateTestDashboard(t *testing.T, sqlStore *SQLStore, dashboard *models.Dashboard, data map[string]interface{}) {
	t.Helper()

	data["id"] = dashboard.Id

	parentVersion := dashboard.Version

	cmd := models.SaveDashboardCommand{
		OrgId:     dashboard.OrgId,
		Overwrite: true,
		Dashboard: simplejson.NewFromAny(data),
	}
	var dash *models.Dashboard
	err := sqlStore.WithDbSession(context.Background(), func(sess *DBSession) error {
		var existing models.Dashboard
		dash = cmd.GetDashboardModel()
		dashWithIdExists, err := sess.Where("id=? AND org_id=?", dash.Id, dash.OrgId).Get(&existing)
		require.NoError(t, err)
		require.True(t, dashWithIdExists)

		if dash.Version != existing.Version {
			dash.SetVersion(existing.Version)
			dash.Version = existing.Version
		}

		dash.SetVersion(dash.Version + 1)
		dash.Created = time.Now()
		dash.Updated = time.Now()
		dash.Id = dashboard.Id
		dash.Uid = util.GenerateShortUID()

		_, err = sess.MustCols("folder_id").ID(dash.Id).Update(dash)
		return err
	})

	require.Nil(t, err)

	err = sqlStore.WithDbSession(context.Background(), func(sess *DBSession) error {
		dashVersion := &models.DashboardVersion{
			DashboardId:   dash.Id,
			ParentVersion: parentVersion,
			RestoredFrom:  cmd.RestoredFrom,
			Version:       dash.Version,
			Created:       time.Now(),
			CreatedBy:     dash.UpdatedBy,
			Message:       cmd.Message,
			Data:          dash.Data,
		}

		if affectedRows, err := sess.Insert(dashVersion); err != nil {
			return err
		} else if affectedRows == 0 {
			return models.ErrDashboardNotFound
		}

		return nil
	})

	require.NoError(t, err)
}

func TestIntegrationGetDashboardVersion(t *testing.T) {
	sqlStore := InitTestDB(t)

	t.Run("Get a Dashboard ID and version ID", func(t *testing.T) {
		savedDash := insertTestDashboard(t, sqlStore, "test dash 26", 1, 0, false, "diff")

		query := models.GetDashboardVersionQuery{
			DashboardId: savedDash.Id,
			Version:     savedDash.Version,
			OrgId:       1,
		}

		err := sqlStore.GetDashboardVersion(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, query.DashboardId, savedDash.Id)
		require.Equal(t, query.Version, savedDash.Version)

		dashCmd := &models.Dashboard{
			Uid:   savedDash.Uid,
			OrgId: savedDash.OrgId,
		}
		err = getDashboard(t, sqlStore, dashCmd)
		require.Nil(t, err)
		eq := reflect.DeepEqual(dashCmd.Data, query.Result.Data)
		require.Equal(t, true, eq)
	})

	t.Run("Attempt to get a version that doesn't exist", func(t *testing.T) {
		query := models.GetDashboardVersionQuery{
			DashboardId: int64(999),
			Version:     123,
			OrgId:       1,
		}

		err := sqlStore.GetDashboardVersion(context.Background(), &query)
		require.Error(t, err)
		require.Equal(t, models.ErrDashboardVersionNotFound, err)
	})
}

func TestIntegrationGetDashboardVersions(t *testing.T) {
	sqlStore := InitTestDB(t)
	savedDash := insertTestDashboard(t, sqlStore, "test dash 43", 1, 0, false, "diff-all")

	t.Run("Get all versions for a given Dashboard ID", func(t *testing.T) {
		query := models.GetDashboardVersionsQuery{DashboardId: savedDash.Id, OrgId: 1}

		err := sqlStore.GetDashboardVersions(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, 1, len(query.Result))
	})

	t.Run("Attempt to get the versions for a non-existent Dashboard ID", func(t *testing.T) {
		query := models.GetDashboardVersionsQuery{DashboardId: int64(999), OrgId: 1}

		err := sqlStore.GetDashboardVersions(context.Background(), &query)
		require.Error(t, err)
		require.Equal(t, models.ErrNoVersionsForDashboardId, err)
		require.Equal(t, 0, len(query.Result))
	})

	t.Run("Get all versions for an updated dashboard", func(t *testing.T) {
		updateTestDashboard(t, sqlStore, savedDash, map[string]interface{}{
			"tags": "different-tag",
		})
		query := models.GetDashboardVersionsQuery{DashboardId: savedDash.Id, OrgId: 1}
		err := sqlStore.GetDashboardVersions(context.Background(), &query)

		require.Nil(t, err)
		require.Equal(t, 2, len(query.Result))
	})
}

func TestIntegrationDeleteExpiredVersions(t *testing.T) {
	versionsToKeep := 5
	versionsToWrite := 10
	setting.DashboardVersionsToKeep = versionsToKeep

	var sqlStore *SQLStore
	var savedDash *models.Dashboard
	setup := func(t *testing.T) {
		sqlStore = InitTestDB(t)
		savedDash = insertTestDashboard(t, sqlStore, "test dash 53", 1, 0, false, "diff-all")
		for i := 0; i < versionsToWrite-1; i++ {
			updateTestDashboard(t, sqlStore, savedDash, map[string]interface{}{
				"tags": "different-tag",
			})
		}
	}

	t.Run("Clean up old dashboard versions", func(t *testing.T) {
		setup(t)
		err := sqlStore.DeleteExpiredVersions(context.Background(), &models.DeleteExpiredVersionsCommand{})
		require.Nil(t, err)

		query := models.GetDashboardVersionsQuery{DashboardId: savedDash.Id, OrgId: 1}
		err = sqlStore.GetDashboardVersions(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, versionsToKeep, len(query.Result))
		// Ensure latest versions were kept
		require.Equal(t, versionsToWrite-versionsToKeep+1, query.Result[versionsToKeep-1].Version)
		require.Equal(t, versionsToWrite, query.Result[0].Version)
	})

	t.Run("Don't delete anything if there are no expired versions", func(t *testing.T) {
		setup(t)
		setting.DashboardVersionsToKeep = versionsToWrite

		err := sqlStore.DeleteExpiredVersions(context.Background(), &models.DeleteExpiredVersionsCommand{})
		require.Nil(t, err)

		query := models.GetDashboardVersionsQuery{DashboardId: savedDash.Id, OrgId: 1, Limit: versionsToWrite}
		err = sqlStore.GetDashboardVersions(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, versionsToWrite, len(query.Result))
	})

	t.Run("Don't delete more than MAX_VERSIONS_TO_DELETE_PER_BATCH * MAX_VERSION_DELETION_BATCHES per iteration", func(t *testing.T) {
		setup(t)
		perBatch := 10
		maxBatches := 10

		versionsToWriteBigNumber := perBatch*maxBatches + versionsToWrite
		for i := 0; i < versionsToWriteBigNumber-versionsToWrite; i++ {
			updateTestDashboard(t, sqlStore, savedDash, map[string]interface{}{
				"tags": "different-tag",
			})
		}

		err := sqlStore.deleteExpiredVersions(context.Background(), &models.DeleteExpiredVersionsCommand{}, perBatch, maxBatches)
		require.Nil(t, err)

		query := models.GetDashboardVersionsQuery{DashboardId: savedDash.Id, OrgId: 1, Limit: versionsToWriteBigNumber}
		err = sqlStore.GetDashboardVersions(context.Background(), &query)
		require.Nil(t, err)

		// Ensure we have at least versionsToKeep versions
		require.GreaterOrEqual(t, len(query.Result), versionsToKeep)
		// Ensure we haven't deleted more than perBatch * maxBatches rows
		require.LessOrEqual(t, versionsToWriteBigNumber-len(query.Result), perBatch*maxBatches)
	})
}

func getDashboard(t *testing.T, sqlStore *SQLStore, dashboard *models.Dashboard) error {
	t.Helper()
	return sqlStore.WithDbSession(context.Background(), func(sess *DBSession) error {
		has, err := sess.Get(dashboard)

		if err != nil {
			return err
		} else if !has {
			return models.ErrDashboardNotFound
		}

		dashboard.SetId(dashboard.Id)
		dashboard.SetUid(dashboard.Uid)
		return nil
	})
}
