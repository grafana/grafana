package folderimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

// run tests with cleanup
func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationDashboardFolderStore(t *testing.T) {
	var sqlStore db.DB
	var cfg *setting.Cfg
	var dashboardStore dashboards.Store

	setup := func() {
		sqlStore, cfg = db.InitTestDBWithCfg(t)
		var err error
		dashboardStore, err = database.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
	}
	t.Run("Given dashboard and folder with the same title", func(t *testing.T) {
		setup()
		var orgId int64 = 1
		title := "Very Unique Name"
		var sqlStore db.DB
		var folder1, folder2 *dashboards.Dashboard
		sqlStore, cfg = db.InitTestDBWithCfg(t)
		folderStore := ProvideDashboardFolderStore(sqlStore)
		folder2 = insertTestFolder(t, dashboardStore, "TEST", orgId, "", "prod")
		_ = insertTestDashboard(t, dashboardStore, title, orgId, folder2.ID, folder2.UID, "prod")
		folder1 = insertTestFolder(t, dashboardStore, title, orgId, "", "prod")

		t.Run("GetFolderByTitle should find the folder", func(t *testing.T) {
			result, err := folderStore.GetFolderByTitle(context.Background(), orgId, title, nil)
			require.NoError(t, err)
			require.Equal(t, folder1.UID, result.UID)
		})

		t.Run("GetFolderByTitle should find the folder by folderUID", func(t *testing.T) {
			folder3 := insertTestFolder(t, dashboardStore, title, orgId, folder2.UID, "prod")
			result, err := folderStore.GetFolderByTitle(context.Background(), orgId, title, &folder2.UID)
			require.NoError(t, err)
			require.Equal(t, folder3.UID, result.UID)
		})
	})

	t.Run("GetFolderByUID", func(t *testing.T) {
		setup()
		var orgId int64 = 1
		sqlStore := db.InitTestDB(t)
		folderStore := ProvideDashboardFolderStore(sqlStore)
		folder := insertTestFolder(t, dashboardStore, "TEST", orgId, "", "prod")
		dash := insertTestDashboard(t, dashboardStore, "Very Unique Name", orgId, folder.ID, folder.UID, "prod")

		t.Run("should return folder by UID", func(t *testing.T) {
			d, err := folderStore.GetFolderByUID(context.Background(), orgId, folder.UID)
			require.Equal(t, folder.UID, d.UID)
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
		setup()
		var orgId int64 = 1
		sqlStore := db.InitTestDB(t)
		folderStore := ProvideDashboardFolderStore(sqlStore)
		folder := insertTestFolder(t, dashboardStore, "TEST", orgId, "", "prod")
		dash := insertTestDashboard(t, dashboardStore, "Very Unique Name", orgId, folder.ID, folder.UID, "prod")

		t.Run("should return folder by ID", func(t *testing.T) {
			d, err := folderStore.GetFolderByID(context.Background(), orgId, folder.ID)
			require.Equal(t, folder.UID, d.UID)
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

func insertTestDashboard(t *testing.T, dashboardStore dashboards.Store, title string, orgId, folderID int64, folderUID string, tags ...any) *dashboards.Dashboard {
	t.Helper()
	cmd := dashboards.SaveDashboardCommand{
		OrgID:     orgId,
		FolderUID: folderUID,
		FolderID:  folderID, // nolint:staticcheck
		IsFolder:  false,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"id":    nil,
			"title": title,
			"tags":  tags,
		}),
	}
	if folderUID != "" {
		cmd.FolderUID = folderUID
	}
	dash, err := dashboardStore.SaveDashboard(context.Background(), cmd)
	require.NoError(t, err)
	require.NotNil(t, dash)
	dash.Data.Set("id", dash.ID)
	dash.Data.Set("uid", dash.UID)
	return dash
}

func insertTestFolder(t *testing.T, dashboardStore dashboards.Store, title string, orgId int64, folderUID string, tags ...any) *dashboards.Dashboard {
	t.Helper()
	cmd := dashboards.SaveDashboardCommand{
		OrgID: orgId,
		// FolderID: folderId, // nolint:staticcheck
		FolderUID: folderUID,
		IsFolder:  true,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"id":    nil,
			"title": title,
			"tags":  tags,
		}),
	}
	if folderUID != "" {
		cmd.FolderUID = folderUID
	}
	dash, err := dashboardStore.SaveDashboard(context.Background(), cmd)
	require.NoError(t, err)
	require.NotNil(t, dash)
	dash.Data.Set("id", dash.ID)
	dash.Data.Set("uid", dash.UID)
	return dash
}
