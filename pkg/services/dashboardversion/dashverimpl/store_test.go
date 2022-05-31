package dashverimpl

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntegrationGetDashboardVersion(t *testing.T) {
	ss := sqlstore.InitTestDB(t)
	dashVerStore := sqlStore{db: ss}

	t.Run("Get a Dashboard ID and version ID", func(t *testing.T) {
		savedDash := insertTestDashboard(t, ss, "test dash 26", 1, 0, false, "diff")

		query := dashver.GetDashboardVersionQuery{
			DashboardID: savedDash.Id,
			Version:     savedDash.Version,
			OrgID:       1,
		}

		res, err := dashVerStore.Get(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, query.DashboardID, savedDash.Id)
		require.Equal(t, query.Version, savedDash.Version)

		dashCmd := &models.Dashboard{
			Id:    res.ID,
			Uid:   savedDash.Uid,
			OrgId: savedDash.OrgId,
		}
		err = getDashboard(t, ss, dashCmd)
		require.Nil(t, err)

		require.EqualValues(t, dashCmd.Data.Get("uid"), res.Data.Get("uid"))
		require.EqualValues(t, dashCmd.Data.Get("orgId"), res.Data.Get("orgId"))
	})

	t.Run("Attempt to get a version that doesn't exist", func(t *testing.T) {
		query := dashver.GetDashboardVersionQuery{
			DashboardID: int64(999),
			Version:     123,
			OrgID:       1,
		}

		_, err := dashVerStore.Get(context.Background(), &query)
		require.Error(t, err)
		require.Equal(t, models.ErrDashboardVersionNotFound, err)
	})
}

func TestIntegrationDeleteExpiredVersions(t *testing.T) {
	versionsToWrite := 10
	ss := sqlstore.InitTestDB(t)
	dashVerStore := sqlStore{db: ss}

	for i := 0; i < versionsToWrite-1; i++ {
		insertTestDashboard(t, ss, "test dash 53", 1, int64(i), false, "diff-all")
	}

	t.Run("Clean up old dashboard versions", func(t *testing.T) {
		versionIDsToDelete := []interface{}{1, 2, 3, 4}
		res, err := dashVerStore.DeleteBatch(
			context.Background(),
			&dashver.DeleteExpiredVersionsCommand{DeletedRows: 4},
			versionIDsToDelete,
		)
		require.Nil(t, err)
		assert.EqualValues(t, 4, res)
	})
}

func getDashboard(t *testing.T, sqlStore *sqlstore.SQLStore, dashboard *models.Dashboard) error {
	t.Helper()
	return sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
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
func insertTestDashboard(t *testing.T, sqlStore *sqlstore.SQLStore, title string, orgId int64,
	folderId int64, isFolder bool, tags ...interface{}) *models.Dashboard {
	t.Helper()
	cmd := models.SaveDashboardCommand{
		OrgId:    orgId,
		FolderId: folderId,
		IsFolder: isFolder,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
			"tags":  tags,
		}),
	}

	var dash *models.Dashboard
	err := sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		dash = cmd.GetDashboardModel()
		dash.SetVersion(1)
		dash.Created = time.Now()
		dash.Updated = time.Now()
		dash.Uid = util.GenerateShortUID()
		_, err := sess.Insert(dash)
		return err
	})

	require.NoError(t, err)
	require.NotNil(t, dash)
	dash.Data.Set("id", dash.Id)
	dash.Data.Set("uid", dash.Uid)

	err = sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		dashVersion := &models.DashboardVersion{
			DashboardId:   dash.Id,
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
			return models.ErrDashboardNotFound
		}

		return nil
	})
	require.NoError(t, err)

	return dash
}
