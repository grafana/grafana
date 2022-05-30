//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
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
