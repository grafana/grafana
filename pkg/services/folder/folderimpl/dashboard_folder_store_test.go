package folderimpl

import (
	"context"
	"path"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

// run tests with cleanup
func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationDashboardFolderStore(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	var sqlStore db.DB
	var cfg *setting.Cfg
	var dashboardStore dashboards.Store

	setup := func() {
		sqlStore, cfg = db.InitTestDBWithCfg(t)
		var err error
		dashboardStore, err = database.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
	}

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

func TestIntegrationGetDashFolderStore(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	db, cfg := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db)
	dashboardStore, err := database.ProvideDashboardStore(db, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(db))
	require.NoError(t, err)
	dashFolderStore := ProvideDashboardFolderStore(db)

	orgID := CreateOrg(t, db, cfg)

	// create folder
	d, err := dashboardStore.SaveDashboard(context.Background(), dashboards.SaveDashboardCommand{
		OrgID:    orgID,
		IsFolder: true,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": folderTitle,
		}),
	})
	require.NoError(t, err)
	uid1 := d.UID
	f, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		Title:       folderTitle,
		Description: folderDsc,
		OrgID:       orgID,
		UID:         uid1,
	})
	require.NoError(t, err)
	d2, err := dashboardStore.SaveDashboard(context.Background(), dashboards.SaveDashboardCommand{
		OrgID:     orgID,
		FolderUID: uid1,
		IsFolder:  true,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": folderTitle,
		}),
	})
	require.NoError(t, err)
	uid2 := d2.UID
	subfolderWithSameName, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		Title:       folderTitle,
		Description: folderDsc,
		OrgID:       orgID,
		UID:         uid2,
		ParentUID:   f.UID,
	})
	require.NoError(t, err)

	t.Run("should gently fail in case of bad request", func(t *testing.T) {
		_, err = dashFolderStore.Get(context.Background(), folder.GetFolderQuery{})
		require.Error(t, err)
	})

	t.Run("get folder by UID should succeed", func(t *testing.T) {
		ff, err := dashFolderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:   &f.UID,
			OrgID: orgID,
		})
		require.NoError(t, err)
		assert.Equal(t, f.UID, ff.UID)
		assert.Equal(t, f.OrgID, ff.OrgID)
		assert.Equal(t, f.Title, ff.Title)
		assert.Equal(t, f.Description, ff.Description)
		//assert.Equal(t, folder.GeneralFolderUID, ff.ParentUID)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
		assert.NotEmpty(t, ff.URL)
	})

	t.Run("get folder by title should succeed", func(t *testing.T) {
		ff, err := dashFolderStore.Get(context.Background(), folder.GetFolderQuery{
			Title: &f.Title,
			OrgID: orgID,
		})
		require.NoError(t, err)
		assert.Equal(t, f.UID, ff.UID)
		assert.Equal(t, f.OrgID, ff.OrgID)
		assert.Equal(t, f.Title, ff.Title)
		assert.Equal(t, f.Description, ff.Description)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
		assert.NotEmpty(t, ff.URL)
	})

	t.Run("get folder by title and parent UID should succeed", func(t *testing.T) {
		ff, err := dashFolderStore.Get(context.Background(), folder.GetFolderQuery{
			Title:     &f.Title,
			OrgID:     orgID,
			ParentUID: &uid1,
		})
		require.NoError(t, err)
		assert.Equal(t, subfolderWithSameName.UID, ff.UID)
		assert.Equal(t, subfolderWithSameName.OrgID, ff.OrgID)
		assert.Equal(t, subfolderWithSameName.Title, ff.Title)
		assert.Equal(t, subfolderWithSameName.Description, ff.Description)
		assert.Equal(t, subfolderWithSameName.ParentUID, ff.ParentUID)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
		assert.NotEmpty(t, ff.URL)
	})

	t.Run("get folder by UID should succeed", func(t *testing.T) {
		ff, err := dashFolderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:   &f.UID,
			OrgID: orgID,
		})
		require.NoError(t, err)
		assert.Equal(t, f.UID, ff.UID)
		assert.Equal(t, f.OrgID, ff.OrgID)
		assert.Equal(t, f.Title, ff.Title)
		assert.Equal(t, f.Description, ff.Description)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
		assert.NotEmpty(t, ff.URL)
	})

	t.Run("get folder with fullpath should set fullpath as expected", func(t *testing.T) {
		ff, err := dashFolderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:          &subfolderWithSameName.UID,
			OrgID:        orgID,
			WithFullpath: true,
		})
		require.NoError(t, err)
		assert.Equal(t, subfolderWithSameName.UID, ff.UID)
		assert.Equal(t, subfolderWithSameName.OrgID, ff.OrgID)
		assert.Equal(t, subfolderWithSameName.Title, ff.Title)
		assert.Equal(t, subfolderWithSameName.Description, ff.Description)
		assert.Equal(t, path.Join(f.Title, subfolderWithSameName.Title), ff.Fullpath)
		assert.Equal(t, f.UID, ff.ParentUID)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
		assert.NotEmpty(t, ff.URL)
	})

	t.Run("get folder withFullpathUIDs should set fullpathUIDs as expected", func(t *testing.T) {
		ff, err := dashFolderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:              &subfolderWithSameName.UID,
			OrgID:            orgID,
			WithFullpathUIDs: true,
		})
		require.NoError(t, err)
		assert.Equal(t, subfolderWithSameName.UID, ff.UID)
		assert.Equal(t, subfolderWithSameName.OrgID, ff.OrgID)
		assert.Equal(t, subfolderWithSameName.Title, ff.Title)
		assert.Equal(t, subfolderWithSameName.Description, ff.Description)
		assert.Equal(t, path.Join(f.UID, subfolderWithSameName.UID), ff.FullpathUIDs)
		assert.Equal(t, f.UID, ff.ParentUID)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
		assert.NotEmpty(t, ff.URL)
	})
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
