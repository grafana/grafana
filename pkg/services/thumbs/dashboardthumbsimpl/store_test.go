package dashboardthumbsimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/thumbs"
	"github.com/grafana/grafana/pkg/util"
)

var theme = models.ThemeDark
var kind = thumbs.ThumbnailKindDefault

func TestIntegrationSqlStorage(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var store store
	var savedFolder *dashboards.Dashboard

	setup := func() {
		sqlStore = db.InitTestDB(t)
		store = &xormStore{db: sqlStore}
		savedFolder = insertTestDashboard(t, sqlStore, "1 test dash folder", 1, 0, true, "prod", "webapp")
	}

	t.Run("Should insert dashboard in default state", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.ID, false, "prod", "webapp")
		upsertTestDashboardThumbnail(t, store, dash.UID, dash.OrgID, dash.Version)
		thumb := getThumbnail(t, store, dash.UID, dash.OrgID)

		require.Positive(t, thumb.Id)
		require.Equal(t, thumbs.ThumbnailStateDefault, thumb.State)
		require.Equal(t, dash.Version, thumb.DashboardVersion)
	})

	t.Run("Should be able to update the thumbnail", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.ID, false, "prod", "webapp")
		upsertTestDashboardThumbnail(t, store, dash.UID, dash.OrgID, dash.Version)
		thumb := getThumbnail(t, store, dash.UID, dash.OrgID)

		insertedThumbnailId := thumb.Id
		upsertTestDashboardThumbnail(t, store, dash.UID, dash.OrgID, dash.Version+1)

		updatedThumb := getThumbnail(t, store, dash.UID, dash.OrgID)
		require.Equal(t, insertedThumbnailId, updatedThumb.Id)
		require.Equal(t, dash.Version+1, updatedThumb.DashboardVersion)
	})

	t.Run("Should return empty array if all dashboards have thumbnails", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.ID, false, "prod", "webapp")

		upsertTestDashboardThumbnail(t, store, dash.UID, dash.OrgID, dash.Version)

		cmd := thumbs.FindDashboardsWithStaleThumbnailsCommand{
			Kind:  kind,
			Theme: theme,
		}
		res, err := store.FindDashboardsWithStaleThumbnails(context.Background(), &cmd)
		require.NoError(t, err)
		require.Len(t, res, 0)
	})

	t.Run("Should return dashboards with thumbnails with empty ds_uids array", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.ID, false, "prod", "webapp")

		upsertTestDashboardThumbnail(t, store, dash.UID, dash.OrgID, dash.Version)

		cmd := thumbs.FindDashboardsWithStaleThumbnailsCommand{
			Kind:                             kind,
			IncludeThumbnailsWithEmptyDsUIDs: true,
			Theme:                            theme,
		}
		res, err := store.FindDashboardsWithStaleThumbnails(context.Background(), &cmd)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.Equal(t, dash.ID, res[0].Id)
	})

	t.Run("Should return dashboards with thumbnails marked as stale", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.ID, false, "prod", "webapp")
		upsertTestDashboardThumbnail(t, store, dash.UID, dash.OrgID, dash.Version)
		updateThumbnailState(t, store, dash.UID, dash.OrgID, thumbs.ThumbnailStateStale)

		cmd := thumbs.FindDashboardsWithStaleThumbnailsCommand{
			Kind:  kind,
			Theme: theme,
		}
		res, err := store.FindDashboardsWithStaleThumbnails(context.Background(), &cmd)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.Equal(t, dash.ID, res[0].Id)
	})

	t.Run("Should not return dashboards with updated thumbnails that had been marked as stale", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.ID, false, "prod", "webapp")
		upsertTestDashboardThumbnail(t, store, dash.UID, dash.OrgID, dash.Version)
		updateThumbnailState(t, store, dash.UID, dash.OrgID, thumbs.ThumbnailStateStale)
		upsertTestDashboardThumbnail(t, store, dash.UID, dash.OrgID, dash.Version)

		cmd := thumbs.FindDashboardsWithStaleThumbnailsCommand{
			Kind:  kind,
			Theme: theme,
		}
		res, err := store.FindDashboardsWithStaleThumbnails(context.Background(), &cmd)
		require.NoError(t, err)
		require.Len(t, res, 0)
	})

	t.Run("Should find dashboards without thumbnails", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.ID, false, "prod", "webapp")

		cmd := thumbs.FindDashboardsWithStaleThumbnailsCommand{
			Kind:  kind,
			Theme: theme,
		}
		res, err := store.FindDashboardsWithStaleThumbnails(context.Background(), &cmd)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.Equal(t, dash.ID, res[0].Id)
	})

	t.Run("Should find dashboards with outdated thumbnails", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.ID, false, "prod", "webapp")
		upsertTestDashboardThumbnail(t, store, dash.UID, dash.OrgID, dash.Version)

		updateTestDashboard(t, sqlStore, dash, map[string]interface{}{
			"tags": "different-tag",
		})

		cmd := thumbs.FindDashboardsWithStaleThumbnailsCommand{
			Kind:  kind,
			Theme: theme,
		}
		res, err := store.FindDashboardsWithStaleThumbnails(context.Background(), &cmd)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.Equal(t, dash.ID, res[0].Id)
	})

	t.Run("Should not return dashboards with locked thumbnails even if they are outdated", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.ID, false, "prod", "webapp")
		upsertTestDashboardThumbnail(t, store, dash.UID, dash.OrgID, dash.Version)
		updateThumbnailState(t, store, dash.UID, dash.OrgID, thumbs.ThumbnailStateLocked)

		updateTestDashboard(t, sqlStore, dash, map[string]interface{}{
			"tags": "different-tag",
		})

		cmd := thumbs.FindDashboardsWithStaleThumbnailsCommand{
			Kind:  kind,
			Theme: theme,
		}
		res, err := store.FindDashboardsWithStaleThumbnails(context.Background(), &cmd)
		require.NoError(t, err)
		require.Len(t, res, 0)
	})

	t.Run("Should not return dashboards with manually uploaded thumbnails by default", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.ID, false, "prod", "webapp")
		upsertTestDashboardThumbnail(t, store, dash.UID, dash.OrgID, thumbs.DashboardVersionForManualThumbnailUpload)

		updateTestDashboard(t, sqlStore, dash, map[string]interface{}{
			"tags": "different-tag",
		})

		cmd := thumbs.FindDashboardsWithStaleThumbnailsCommand{
			Kind:  kind,
			Theme: theme,
		}
		res, err := store.FindDashboardsWithStaleThumbnails(context.Background(), &cmd)
		require.NoError(t, err)
		require.Len(t, res, 0)
	})

	t.Run("Should return dashboards with manually uploaded thumbnails if requested", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.ID, false, "prod", "webapp")
		upsertTestDashboardThumbnail(t, store, dash.UID, dash.OrgID, thumbs.DashboardVersionForManualThumbnailUpload)

		updateTestDashboard(t, sqlStore, dash, map[string]interface{}{
			"tags": "different-tag",
		})

		cmd := thumbs.FindDashboardsWithStaleThumbnailsCommand{
			Kind:                              kind,
			Theme:                             theme,
			IncludeManuallyUploadedThumbnails: true,
		}
		res, err := store.FindDashboardsWithStaleThumbnails(context.Background(), &cmd)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.Equal(t, dash.ID, res[0].Id)
	})

	t.Run("Should count all dashboard thumbnails", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.ID, false, "prod", "webapp")
		upsertTestDashboardThumbnail(t, store, dash.UID, dash.OrgID, 1)
		dash2 := insertTestDashboard(t, sqlStore, "test dash 23", 2, savedFolder.ID, false, "prod", "webapp")
		upsertTestDashboardThumbnail(t, store, dash2.UID, dash2.OrgID, 1)

		updateTestDashboard(t, sqlStore, dash, map[string]interface{}{
			"tags": "different-tag",
		})

		cmd := thumbs.FindDashboardThumbnailCountCommand{}
		res, err := store.Count(context.Background(), &cmd)
		require.NoError(t, err)
		require.Equal(t, res, int64(2))
	})
}

func getThumbnail(t *testing.T, store store, dashboardUID string, orgId int64) *thumbs.DashboardThumbnail {
	t.Helper()
	cmd := thumbs.GetDashboardThumbnailCommand{
		DashboardThumbnailMeta: thumbs.DashboardThumbnailMeta{
			DashboardUID: dashboardUID,
			OrgId:        orgId,
			PanelID:      0,
			Kind:         kind,
			Theme:        theme,
		},
	}

	thumb, err := store.Get(context.Background(), &cmd)
	require.NoError(t, err)
	return thumb
}

func upsertTestDashboardThumbnail(t *testing.T, store store, dashboardUID string, orgId int64, dashboardVersion int) *thumbs.DashboardThumbnail {
	t.Helper()
	cmd := thumbs.SaveDashboardThumbnailCommand{
		DashboardThumbnailMeta: thumbs.DashboardThumbnailMeta{
			DashboardUID: dashboardUID,
			OrgId:        orgId,
			PanelID:      0,
			Kind:         kind,
			Theme:        theme,
		},
		DashboardVersion: dashboardVersion,
		Image:            make([]byte, 0),
		MimeType:         "image/png",
	}
	dash, err := store.Save(context.Background(), &cmd)
	require.NoError(t, err)
	require.NotNil(t, dash)

	return dash
}

func updateThumbnailState(t *testing.T, store store, dashboardUID string, orgId int64, state thumbs.ThumbnailState) {
	t.Helper()
	cmd := thumbs.UpdateThumbnailStateCommand{
		DashboardThumbnailMeta: thumbs.DashboardThumbnailMeta{
			DashboardUID: dashboardUID,
			OrgId:        orgId,
			PanelID:      0,
			Kind:         kind,
			Theme:        theme,
		},
		State: state,
	}
	err := store.UpdateState(context.Background(), &cmd)
	require.NoError(t, err)
}

func updateTestDashboard(t *testing.T, sqlStore db.DB, dashModel *dashboards.Dashboard, data map[string]interface{}) {
	t.Helper()

	data["id"] = dashModel.ID

	parentVersion := dashModel.Version

	cmd := dashboards.SaveDashboardCommand{
		OrgID:     dashModel.OrgID,
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
		dash.ID = dashModel.ID
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
		require.NoError(t, err)

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
