package dashverimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/util"
)

type getStore func(db.DB) store

func testIntegrationGetDashboardVersion(t *testing.T, fn getStore) {
	t.Helper()

	ss := db.InitTestDB(t)
	dashVerStore := fn(ss)

	t.Run("Get a Dashboard ID and version ID", func(t *testing.T) {
		savedDash := insertTestDashboard(t, ss, "test dash 26", 1, 0, false, "diff")

		query := dashver.GetDashboardVersionQuery{
			DashboardID: savedDash.ID,
			Version:     savedDash.Version,
			OrgID:       1,
		}

		res, err := dashVerStore.Get(context.Background(), &query)
		require.Nil(t, err)
		assert.Equal(t, savedDash.ID, res.ID)
		assert.Equal(t, savedDash.Version, res.Version)
		assert.Equal(t, createdById, res.CreatedBy)

		dashCmd := &dashboards.Dashboard{
			ID:    res.ID,
			UID:   savedDash.UID,
			OrgID: savedDash.OrgID,
		}
		err = getDashboard(t, ss, dashCmd)
		require.Nil(t, err)

		assert.EqualValues(t, dashCmd.Data.Get("uid"), res.Data.Get("uid"))
		assert.EqualValues(t, dashCmd.Data.Get("orgId"), res.Data.Get("orgId"))
		assert.Equal(t, createdById, res.CreatedBy)
	})

	t.Run("Attempt to get a version that doesn't exist", func(t *testing.T) {
		query := dashver.GetDashboardVersionQuery{
			DashboardID: int64(999),
			Version:     123,
			OrgID:       1,
		}

		_, err := dashVerStore.Get(context.Background(), &query)
		require.Error(t, err)
		assert.Equal(t, dashver.ErrDashboardVersionNotFound, err)
	})

	t.Run("Clean up old dashboard versions", func(t *testing.T) {
		versionsToWrite := 10
		for i := 0; i < versionsToWrite-1; i++ {
			insertTestDashboard(t, ss, "test dash 53", 1, int64(i), false, "diff-all")
		}
		versionIDsToDelete := []interface{}{1, 2, 3, 4}
		res, err := dashVerStore.DeleteBatch(
			context.Background(),
			&dashver.DeleteExpiredVersionsCommand{DeletedRows: 4},
			versionIDsToDelete,
		)
		require.Nil(t, err)
		assert.EqualValues(t, 4, res)
	})

	savedDash := insertTestDashboard(t, ss, "test dash 43", 1, 0, false, "diff-all")
	t.Run("Get all versions for a given Dashboard ID", func(t *testing.T) {
		query := dashver.ListDashboardVersionsQuery{
			DashboardID: savedDash.ID,
			OrgID:       1,
			Limit:       1000,
		}

		res, err := dashVerStore.List(context.Background(), &query)
		require.Nil(t, err)
		assert.Equal(t, 1, len(res))
	})

	t.Run("Attempt to get the versions for a non-existent Dashboard ID", func(t *testing.T) {
		query := dashver.ListDashboardVersionsQuery{DashboardID: int64(999), OrgID: 1, Limit: 1000}

		res, err := dashVerStore.List(context.Background(), &query)
		require.Error(t, err)
		assert.ErrorIs(t, dashver.ErrNoVersionsForDashboardID, err)
		assert.Equal(t, 0, len(res))
	})

	t.Run("Get all versions for an updated dashboard", func(t *testing.T) {
		updateTestDashboard(t, ss, savedDash, map[string]interface{}{
			"tags": "different-tag",
		})
		query := dashver.ListDashboardVersionsQuery{DashboardID: savedDash.ID, OrgID: 1, Limit: 1000}
		res, err := dashVerStore.List(context.Background(), &query)

		require.Nil(t, err)
		assert.Equal(t, 2, len(res))
	})
}

func getDashboard(t *testing.T, sqlStore db.DB, dashboard *dashboards.Dashboard) error {
	t.Helper()
	return sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		has, err := sess.Get(dashboard)

		if err != nil {
			return err
		} else if !has {
			return dashboards.ErrDashboardNotFound
		}

		dashboard.SetID(dashboard.ID)
		dashboard.SetUID(dashboard.UID)
		return nil
	})
}

var (
	createdById = int64(3)
)

func insertTestDashboard(t *testing.T, sqlStore db.DB, title string, orgId int64,
	folderId int64, isFolder bool, tags ...interface{}) *dashboards.Dashboard {
	t.Helper()
	cmd := dashboards.SaveDashboardCommand{
		OrgID:    orgId,
		FolderID: folderId,
		IsFolder: isFolder,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
			"tags":  tags,
		}),
		UserID: createdById,
	}

	var dash *dashboards.Dashboard
	err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		dash = cmd.GetDashboardModel()
		dash.SetVersion(1)
		dash.Created = time.Now()
		dash.Updated = time.Now()
		dash.UID = util.GenerateShortUID()
		_, err := sess.Insert(dash)
		return err
	})

	require.NoError(t, err)
	require.NotNil(t, dash)
	dash.Data.Set("id", dash.ID)
	dash.Data.Set("uid", dash.UID)

	err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		dashVersion := &dashver.DashboardVersion{
			DashboardID:   dash.ID,
			ParentVersion: dash.Version,
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
			return dashboards.ErrDashboardNotFound
		}

		return nil
	})
	require.NoError(t, err)

	return dash
}

func updateTestDashboard(t *testing.T, sqlStore db.DB, dashboard *dashboards.Dashboard, data map[string]interface{}) {
	t.Helper()

	data["id"] = dashboard.ID

	parentVersion := dashboard.Version

	cmd := dashboards.SaveDashboardCommand{
		OrgID:     dashboard.OrgID,
		Overwrite: true,
		Dashboard: simplejson.NewFromAny(data),
	}
	var dash *dashboards.Dashboard
	err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		var existing dashboards.Dashboard
		dash = cmd.GetDashboardModel()
		dashWithIdExists, err := sess.Where("id=? AND org_id=?", dash.ID, dash.OrgID).Get(&existing)
		require.NoError(t, err)
		require.True(t, dashWithIdExists)

		if dash.Version != existing.Version {
			dash.SetVersion(existing.Version)
			dash.Version = existing.Version
		}

		dash.SetVersion(dash.Version + 1)
		dash.Created = time.Now()
		dash.Updated = time.Now()
		dash.ID = dashboard.ID
		dash.UID = util.GenerateShortUID()

		_, err = sess.MustCols("folder_id").ID(dash.ID).Update(dash)
		return err
	})

	require.Nil(t, err)

	err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		dashVersion := &dashver.DashboardVersion{
			DashboardID:   dash.ID,
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
			return dashboards.ErrDashboardNotFound
		}

		return nil
	})

	require.NoError(t, err)
}
