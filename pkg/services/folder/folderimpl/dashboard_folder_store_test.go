package folderimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestIntegrationDashboardFolderStore(t *testing.T) {
	var sqlStore *sqlstore.SQLStore
	var cfg *setting.Cfg
	var dashboardStore dashboards.Store

	setup := func() {
		sqlStore, cfg = db.InitTestDBwithCfg(t)
		quotaService := quotatest.New(false, nil)
		var err error
		dashboardStore, err = database.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch), tagimpl.ProvideService(sqlStore, cfg), quotaService)
		require.NoError(t, err)
	}
	t.Run("Given dashboard and folder with the same title", func(t *testing.T) {
		setup()
		var orgId int64 = 1
		title := "Very Unique Name"
		var sqlStore *sqlstore.SQLStore
		var folder1, folder2 *dashboards.Dashboard
		sqlStore = db.InitTestDB(t)
		folderStore := ProvideDashboardFolderStore(sqlStore)
		folder2 = insertTestFolder(t, dashboardStore, "TEST", orgId, 0, "prod")
		_ = insertTestDashboard(t, dashboardStore, title, orgId, folder2.ID, "prod")
		folder1 = insertTestFolder(t, dashboardStore, title, orgId, 0, "prod")

		t.Run("GetFolderByTitle should find the folder", func(t *testing.T) {
			result, err := folderStore.GetFolderByTitle(context.Background(), orgId, title)
			require.NoError(t, err)
			require.Equal(t, folder1.ID, result.ID)
		})
	})

	t.Run("GetFolderByUID", func(t *testing.T) {
		var orgId int64 = 1
		sqlStore := db.InitTestDB(t)
		folderStore := ProvideDashboardFolderStore(sqlStore)
		folder := insertTestFolder(t, dashboardStore, "TEST", orgId, 0, "prod")
		dash := insertTestDashboard(t, dashboardStore, "Very Unique Name", orgId, folder.ID, "prod")

		t.Run("should return folder by UID", func(t *testing.T) {
			d, err := folderStore.GetFolderByUID(context.Background(), orgId, folder.UID)
			require.Equal(t, folder.ID, d.ID)
			require.NoError(t, err)
		})
		t.Run("should not find dashboard", func(t *testing.T) {
			d, err := folderStore.GetFolderByUID(context.Background(), orgId, dash.UID)
			require.Nil(t, d)
			require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
		})
		t.Run("should search in organization", func(t *testing.T) {
			d, err := folderStore.GetFolderByUID(context.Background(), orgId+1, folder.UID)
			require.Nil(t, d)
			require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
		})
	})

	t.Run("GetFolderByID", func(t *testing.T) {
		var orgId int64 = 1
		sqlStore := db.InitTestDB(t)
		folderStore := ProvideDashboardFolderStore(sqlStore)
		folder := insertTestFolder(t, dashboardStore, "TEST", orgId, 0, "prod")
		dash := insertTestDashboard(t, dashboardStore, "Very Unique Name", orgId, folder.ID, "prod")

		t.Run("should return folder by ID", func(t *testing.T) {
			d, err := folderStore.GetFolderByID(context.Background(), orgId, folder.ID)
			require.Equal(t, folder.ID, d.ID)
			require.NoError(t, err)
		})
		t.Run("should not find dashboard", func(t *testing.T) {
			d, err := folderStore.GetFolderByID(context.Background(), orgId, dash.ID)
			require.Nil(t, d)
			require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
		})
		t.Run("should search in organization", func(t *testing.T) {
			d, err := folderStore.GetFolderByID(context.Background(), orgId+1, folder.ID)
			require.Nil(t, d)
			require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
		})
	})
}

func insertTestDashboard(t *testing.T, dashboardStore dashboards.Store, title string, orgId int64, folderId int64, tags ...interface{}) *dashboards.Dashboard {
	t.Helper()
	cmd := dashboards.SaveDashboardCommand{
		OrgID:    orgId,
		FolderID: folderId,
		IsFolder: false,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
			"tags":  tags,
		}),
	}
	dash, err := dashboardStore.SaveDashboard(context.Background(), cmd)
	require.NoError(t, err)
	require.NotNil(t, dash)
	dash.Data.Set("id", dash.ID)
	dash.Data.Set("uid", dash.UID)
	return dash
}

func insertTestFolder(t *testing.T, dashboardStore dashboards.Store, title string, orgId int64, folderId int64, tags ...interface{}) *dashboards.Dashboard {
	t.Helper()
	cmd := dashboards.SaveDashboardCommand{
		OrgID:    orgId,
		FolderID: folderId,
		IsFolder: true,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
			"tags":  tags,
		}),
	}
	dash, err := dashboardStore.SaveDashboard(context.Background(), cmd)
	require.NoError(t, err)
	require.NotNil(t, dash)
	dash.Data.Set("id", dash.ID)
	dash.Data.Set("uid", dash.UID)
	return dash
}
