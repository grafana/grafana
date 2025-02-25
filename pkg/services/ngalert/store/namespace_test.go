package store

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegration_GetUserVisibleNamespaces(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)

	admin := &user.SignedInUser{
		UserID:         1,
		OrgID:          1,
		OrgRole:        org.RoleAdmin,
		IsGrafanaAdmin: true,
	}

	folders := []struct {
		uid       string
		title     string
		parentUid string
	}{
		{uid: uuid.NewString(), title: "folder1", parentUid: ""},
		{uid: uuid.NewString(), title: "folder2", parentUid: ""},
		{uid: uuid.NewString(), title: "nested/folder", parentUid: ""},
	}

	for _, f := range folders {
		createFolder(t, store, f.uid, f.title, 1, f.parentUid)
	}

	t.Run("returns all folders", func(t *testing.T) {
		namespaces, err := store.GetUserVisibleNamespaces(context.Background(), 1, admin)
		require.NoError(t, err)
		require.Len(t, namespaces, len(folders))
	})

	t.Run("returns empty list for a non existing org", func(t *testing.T) {
		emptyOrgID := int64(999)
		namespaces, err := store.GetUserVisibleNamespaces(context.Background(), emptyOrgID, admin)
		require.NoError(t, err)
		require.Empty(t, namespaces)
	})
}

func TestIntegration_GetNamespaceByUID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)

	u := &user.SignedInUser{
		UserID:         1,
		OrgID:          1,
		OrgRole:        org.RoleAdmin,
		IsGrafanaAdmin: true,
	}

	uid := uuid.NewString()
	parentUid := uuid.NewString()
	title := "folder/title"
	parentTitle := "parent-title"
	createFolder(t, store, parentUid, parentTitle, 1, "")
	createFolder(t, store, uid, title, 1, parentUid)

	actual, err := store.GetNamespaceByUID(context.Background(), uid, 1, u)
	require.NoError(t, err)
	require.Equal(t, title, actual.Title)
	require.Equal(t, uid, actual.UID)
	require.Equal(t, title, actual.Fullpath)

	t.Run("error when user does not have permissions", func(t *testing.T) {
		someUser := &user.SignedInUser{
			UserID:  2,
			OrgID:   1,
			OrgRole: org.RoleViewer,
		}
		_, err = store.GetNamespaceByUID(context.Background(), uid, 1, someUser)
		require.ErrorIs(t, err, dashboards.ErrFolderAccessDenied)
	})

	t.Run("error when folder does not exist", func(t *testing.T) {
		nonExistentUID := uuid.NewString()
		_, err := store.GetNamespaceByUID(context.Background(), nonExistentUID, 1, u)
		require.ErrorIs(t, err, dashboards.ErrFolderAccessDenied)
	})

	t.Run("when nested folders are enabled full path should be populated with correct value", func(t *testing.T) {
		store.FolderService = setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders))
		actual, err := store.GetNamespaceByUID(context.Background(), uid, 1, u)
		require.NoError(t, err)
		require.Equal(t, title, actual.Title)
		require.Equal(t, uid, actual.UID)
		require.Equal(t, "parent-title/folder\\/title", actual.Fullpath)
	})
}

func TestIntegration_GetNamespaceInRootByTitle(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)
	store.FolderService = setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders))

	u := &user.SignedInUser{
		UserID:         1,
		OrgID:          1,
		OrgRole:        org.RoleAdmin,
		IsGrafanaAdmin: true,
	}

	uid := uuid.NewString()
	title := "folder-title"
	createFolder(t, store, uid, title, 1, "")

	actual, err := store.GetNamespaceInRootByTitle(context.Background(), title, 1, u)
	require.NoError(t, err)
	require.Equal(t, title, actual.Title)
	require.Equal(t, uid, actual.UID)
}

func TestIntegration_GetOrCreateNamespaceInRootByTitle(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	u := &user.SignedInUser{
		UserID:         1,
		OrgID:          1,
		OrgRole:        org.RoleAdmin,
		IsGrafanaAdmin: true,
	}

	setupStore := func(t *testing.T) *DBstore {
		sqlStore := db.InitTestDB(t)
		cfg := setting.NewCfg()
		folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
		b := &fakeBus{}
		logger := log.New("test-dbstore")
		store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)
		store.FolderService = setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders))

		return store
	}

	t.Run("should create folder when it does not exist", func(t *testing.T) {
		store := setupStore(t)

		f, err := store.GetOrCreateNamespaceInRootByTitle(context.Background(), "new folder", 1, u)
		require.NoError(t, err)
		require.Equal(t, "new folder", f.Title)
		require.NotEmpty(t, f.UID)

		folders, err := store.FolderService.GetFolders(
			context.Background(),
			folder.GetFoldersQuery{
				OrgID:        1,
				WithFullpath: true,
				SignedInUser: u,
			},
		)
		require.NoError(t, err)
		require.Len(t, folders, 1)
	})

	t.Run("should return existing folder when it exists", func(t *testing.T) {
		store := setupStore(t)

		title := "existing folder"
		createFolder(t, store, "", title, 1, "")
		f, err := store.GetOrCreateNamespaceInRootByTitle(context.Background(), title, 1, u)
		require.NoError(t, err)
		require.Equal(t, title, f.Title)

		folders, err := store.FolderService.GetFolders(
			context.Background(),
			folder.GetFoldersQuery{
				OrgID:        1,
				WithFullpath: true,
				SignedInUser: u,
			},
		)
		require.NoError(t, err)
		require.Len(t, folders, 1)
	})
}
