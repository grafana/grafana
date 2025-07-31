package store

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegration_GetUserVisibleNamespaces(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	folderService := setupFolderService(t, sqlStore, setting.ProvideService(cfg), featuremgmt.WithFeatures())
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
	folderService := setupFolderService(t, sqlStore, setting.ProvideService(cfg), featuremgmt.WithFeatures())
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
		store.FolderService = setupFolderService(t, sqlStore, setting.ProvideService(cfg), featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders))
		actual, err := store.GetNamespaceByUID(context.Background(), uid, 1, u)
		require.NoError(t, err)
		require.Equal(t, title, actual.Title)
		require.Equal(t, uid, actual.UID)
		require.Equal(t, "parent-title/folder\\/title", actual.Fullpath)
	})
}

func TestIntegration_GetNamespaceByTitle(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	settingsProvider := setting.ProvideService(cfg)
	folderService := setupFolderService(t, sqlStore, settingsProvider, featuremgmt.WithFeatures())
	b := &fakeBus{}
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)
	store.FolderService = setupFolderService(t, sqlStore, settingsProvider, featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders))

	u := &user.SignedInUser{
		UserID:         1,
		OrgID:          1,
		OrgRole:        org.RoleAdmin,
		IsGrafanaAdmin: true,
	}

	// Create parent folder
	parentUID := uuid.NewString()
	parentTitle := "parent-folder"
	createFolder(t, store, parentUID, parentTitle, 1, "")

	// Create child folder under parent
	childUID := uuid.NewString()
	childTitle := "child-folder"
	createFolder(t, store, childUID, childTitle, 1, parentUID)

	// Create another folder with same title but under root
	sameTitleInRoot := uuid.NewString()
	createFolder(t, store, sameTitleInRoot, childTitle, 1, "")

	t.Run("should find folder by title and parent UID", func(t *testing.T) {
		actual, err := store.GetNamespaceByTitle(context.Background(), childTitle, 1, u, parentUID)
		require.NoError(t, err)
		require.Equal(t, childTitle, actual.Title)
		require.Equal(t, childUID, actual.UID)
		require.Equal(t, parentUID, actual.ParentUID)
	})

	t.Run("should find folder by title in root", func(t *testing.T) {
		actual, err := store.GetNamespaceByTitle(context.Background(), childTitle, 1, u, folder.RootFolderUID)
		require.NoError(t, err)
		require.Equal(t, childTitle, actual.Title)
		require.Equal(t, sameTitleInRoot, actual.UID)
		require.Equal(t, folder.RootFolderUID, actual.ParentUID)
	})

	t.Run("should return ErrFolderNotFound when folder with title doesn't exist under specified parent", func(t *testing.T) {
		nonExistentTitle := "non-existent-folder"
		f, err := store.GetNamespaceByTitle(context.Background(), nonExistentTitle, 1, u, parentUID)
		require.Nil(t, f)
		require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
	})
}

func TestIntegration_GetOrCreateNamespaceByTitle(t *testing.T) {
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
		settingsProvider := setting.ProvideService(cfg)
		folderService := setupFolderService(t, sqlStore, settingsProvider, featuremgmt.WithFeatures())
		b := &fakeBus{}
		logger := log.New("test-dbstore")
		store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)
		store.FolderService = setupFolderService(t, sqlStore, settingsProvider, featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders))

		return store
	}

	t.Run("should return error when title is empty", func(t *testing.T) {
		store := setupStore(t)
		_, err := store.GetOrCreateNamespaceByTitle(context.Background(), "", 1, u, folder.RootFolderUID)
		require.Error(t, err)
		require.Contains(t, err.Error(), "title is empty")
	})

	t.Run("should create folder when it does not exist", func(t *testing.T) {
		store := setupStore(t)

		f, err := store.GetOrCreateNamespaceByTitle(context.Background(), "new folder", 1, u, folder.RootFolderUID)
		require.NoError(t, err)
		require.Equal(t, "new folder", f.Title)
		require.NotEmpty(t, f.UID)
		require.Equal(t, folder.RootFolderUID, f.ParentUID)

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
		f, err := store.GetOrCreateNamespaceByTitle(context.Background(), title, 1, u, folder.RootFolderUID)
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

	t.Run("should create folder under specified parent when it does not exist", func(t *testing.T) {
		store := setupStore(t)

		// Create parent folder first
		parentTitle := "parent folder"
		parentFolder, err := store.GetOrCreateNamespaceByTitle(context.Background(), parentTitle, 1, u, folder.RootFolderUID)
		require.NoError(t, err)

		// Now create a child folder under the parent
		childTitle := "child folder"
		childFolder, err := store.GetOrCreateNamespaceByTitle(context.Background(), childTitle, 1, u, parentFolder.UID)
		require.NoError(t, err)

		// Verify the child folder was created under the parent
		folders, err := store.FolderService.GetChildren(context.Background(), &folder.GetChildrenQuery{UID: parentFolder.UID, OrgID: 1, SignedInUser: u})
		require.NoError(t, err)
		require.Len(t, folders, 1)
		require.Equal(t, childFolder.UID, folders[0].UID)

		folders, err = store.FolderService.GetChildren(context.Background(), &folder.GetChildrenQuery{UID: folder.RootFolderUID, OrgID: 1, SignedInUser: u})
		require.NoError(t, err)
		require.Len(t, folders, 1)
		require.Equal(t, parentFolder.UID, folders[0].UID)
	})

	t.Run("should get correct folder when same title exists under different parents", func(t *testing.T) {
		store := setupStore(t)

		// Create first parent folder
		parent1Title := "parent folder 1"
		parent1, err := store.GetOrCreateNamespaceByTitle(context.Background(), parent1Title, 1, u, folder.RootFolderUID)
		require.NoError(t, err)

		// Create second parent folder
		parent2Title := "parent folder 2"
		parent2, err := store.GetOrCreateNamespaceByTitle(context.Background(), parent2Title, 1, u, folder.RootFolderUID)
		require.NoError(t, err)

		// Create folders with same title under different parents
		sameTitle := "same title folder"

		// Create under first parent
		folder1, err := store.GetOrCreateNamespaceByTitle(context.Background(), sameTitle, 1, u, parent1.UID)
		require.NoError(t, err)

		// Create under second parent
		folder2, err := store.GetOrCreateNamespaceByTitle(context.Background(), sameTitle, 1, u, parent2.UID)
		require.NoError(t, err)

		// Create under root
		folder3, err := store.GetOrCreateNamespaceByTitle(context.Background(), sameTitle, 1, u, folder.RootFolderUID)
		require.NoError(t, err)

		// Verify we get the correct folders when specifying the parent
		gotFolder1, err := store.GetOrCreateNamespaceByTitle(context.Background(), sameTitle, 1, u, parent1.UID)
		require.NoError(t, err)
		require.Equal(t, folder1.UID, gotFolder1.UID)
		require.Equal(t, parent1.UID, gotFolder1.ParentUID)

		gotFolder2, err := store.GetOrCreateNamespaceByTitle(context.Background(), sameTitle, 1, u, parent2.UID)
		require.NoError(t, err)
		require.Equal(t, folder2.UID, gotFolder2.UID)
		require.Equal(t, parent2.UID, gotFolder2.ParentUID)

		gotFolder3, err := store.GetOrCreateNamespaceByTitle(context.Background(), sameTitle, 1, u, folder.RootFolderUID)
		require.NoError(t, err)
		require.Equal(t, folder3.UID, gotFolder3.UID)
		require.Equal(t, folder.RootFolderUID, gotFolder3.ParentUID)
	})

	t.Run("should create folder with deterministic UID and handle race conditions", func(t *testing.T) {
		store := setupStore(t)

		folderTitle := "race condition test folder"
		parentUID := folder.RootFolderUID

		// Calculate the expected UID that would be generated
		expectedUID, err := generateAlertingFolderUID(folderTitle, parentUID, 1)
		require.NoError(t, err)

		// Create a folder first, simulating another concurrent call that succeeded first
		createFolder(t, store, expectedUID, folderTitle, 1, parentUID)

		// Now try to create a folder with the same title and parent
		// This should not create a duplicate folder but return the existing one
		f, err := store.GetOrCreateNamespaceByTitle(context.Background(), folderTitle, 1, u, parentUID)
		require.NoError(t, err)
		require.Equal(t, expectedUID, f.UID, "Should return folder with same UID as would be deterministically generated")
		require.Equal(t, folderTitle, f.Title)
		require.Equal(t, parentUID, f.ParentUID)

		// Verify only one folder was created
		folders, err := store.FolderService.GetFolders(
			context.Background(),
			folder.GetFoldersQuery{
				OrgID:        1,
				WithFullpath: true,
				SignedInUser: u,
			},
		)
		require.NoError(t, err)
		require.Len(t, folders, 1, "Only one folder should exist")
	})

	t.Run("should handle special characters in folder titles", func(t *testing.T) {
		store := setupStore(t)
		specialTitles := []string{
			"folder/with/slashes",
			"folder with spaces",
			"folder-with-dashes",
			"folder_with_underscores",
			"folder.with.dots",
			"!@#$%^&*()",
		}

		for _, title := range specialTitles {
			t.Run(title, func(t *testing.T) {
				f, err := store.GetOrCreateNamespaceByTitle(context.Background(), title, 1, u, folder.RootFolderUID)
				require.NoError(t, err)
				require.Equal(t, title, f.Title)

				// Verify retrieval works
				retrieved, err := store.GetNamespaceByTitle(context.Background(), title, 1, u, folder.RootFolderUID)
				require.NoError(t, err)
				require.Equal(t, f.UID, retrieved.UID)
			})
		}
	})
}

func TestIntegration_GetNamespaceChildren(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	settingsProvider := setting.ProvideService(cfg)
	folderService := setupFolderService(t, sqlStore, settingsProvider, featuremgmt.WithFeatures())
	b := &fakeBus{}
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)
	store.FolderService = setupFolderService(t, sqlStore, settingsProvider, featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders))

	admin := &user.SignedInUser{
		UserID:         1,
		OrgID:          1,
		OrgRole:        org.RoleAdmin,
		IsGrafanaAdmin: true,
	}

	// Create root folders
	rootFolder1 := uuid.NewString()
	rootFolder2 := uuid.NewString()
	createFolder(t, store, rootFolder1, "Root Folder 1", 1, "")
	createFolder(t, store, rootFolder2, "Root Folder 2", 1, "")

	// Create child folders under root folder 1
	child1 := uuid.NewString()
	child2 := uuid.NewString()
	createFolder(t, store, child1, "Child Folder 1", 1, rootFolder1)
	createFolder(t, store, child2, "Child Folder 2", 1, rootFolder1)

	// Create nested child under child1
	nestedChild := uuid.NewString()
	createFolder(t, store, nestedChild, "Nested Child", 1, child1)

	differentOrgID := int64(999)
	createFolder(t, store, util.GenerateShortUID(), "Root Folder 1", differentOrgID, "")

	/*
	 * Folder structure:
	 *
	 * Root Folder 1
	 *  - Child Folder 1
	 *    - Nested Child
	 *  - Child Folder 2
	 * Root Folder 2
	 */

	t.Run("should return direct children of a folder", func(t *testing.T) {
		children, err := store.GetNamespaceChildren(context.Background(), rootFolder1, 1, admin)
		require.NoError(t, err)
		require.Len(t, children, 2)

		require.ElementsMatch(t, []string{child1, child2}, []string{children[0].UID, children[1].UID})

		// Verify parent UID
		for _, child := range children {
			require.Equal(t, rootFolder1, child.ParentUID)
		}
	})

	t.Run("should return direct children of a nested folder", func(t *testing.T) {
		children, err := store.GetNamespaceChildren(context.Background(), child1, 1, admin)
		require.NoError(t, err)
		require.Len(t, children, 1)
		require.Equal(t, nestedChild, children[0].UID)
		require.Equal(t, child1, children[0].ParentUID)
	})

	t.Run("should return nil when folder does not exist", func(t *testing.T) {
		nonExistentUID := uuid.NewString()
		children, err := store.GetNamespaceChildren(context.Background(), nonExistentUID, 1, admin)
		require.NotNil(t, children)
		require.Empty(t, children)
		require.Nil(t, err)
	})

	t.Run("should return empty array for folders with no children", func(t *testing.T) {
		children, err := store.GetNamespaceChildren(context.Background(), rootFolder2, 1, admin)
		require.Empty(t, children)
		require.NotNil(t, children)
		require.Nil(t, err)
	})

	t.Run("should return no children for a different org", func(t *testing.T) {
		children, err := store.GetNamespaceChildren(context.Background(), rootFolder1, differentOrgID, admin)
		require.Empty(t, children)
		require.Nil(t, err)
	})

	t.Run("should return children from root folder", func(t *testing.T) {
		children, err := store.GetNamespaceChildren(context.Background(), "", 1, admin)
		require.NoError(t, err)
		require.Equal(t, len(children), 2)
		require.ElementsMatch(t, []string{rootFolder1, rootFolder2}, []string{children[0].UID, children[1].UID})
	})
}

func TestGenerateAlertingFolderUID(t *testing.T) {
	const orgID int64 = 1

	t.Run("should generate deterministic UIDs for same inputs", func(t *testing.T) {
		title := "Test Folder"
		parentUID := "parent123"

		uid1, err := generateAlertingFolderUID(title, parentUID, orgID)
		require.NoError(t, err)
		require.True(t, util.IsValidShortUID(uid1), "Generated UID should be valid")

		uid2, err := generateAlertingFolderUID(title, parentUID, orgID)
		require.NoError(t, err)
		require.True(t, util.IsValidShortUID(uid2), "Generated UID should be valid")

		require.Equal(t, uid1, uid2, "UIDs should be identical for same inputs")
		require.True(t, strings.HasPrefix(uid1, "alerting-"), "UID should have alerting prefix")
	})

	t.Run("should generate different UIDs for different inputs", func(t *testing.T) {
		uid1, err := generateAlertingFolderUID("Folder1", "parent1", orgID)
		require.NoError(t, err)
		require.True(t, util.IsValidShortUID(uid1), "Generated UID should be valid")

		uid2, err := generateAlertingFolderUID("Folder2", "parent1", orgID)
		require.NoError(t, err)
		require.True(t, util.IsValidShortUID(uid2), "Generated UID should be valid")

		uid3, err := generateAlertingFolderUID("Folder1", "parent2", orgID)
		require.NoError(t, err)
		require.True(t, util.IsValidShortUID(uid3), "Generated UID should be valid")

		require.NotEqual(t, uid1, uid2, "UIDs should differ for different titles")
		require.NotEqual(t, uid1, uid3, "UIDs should differ for different parent UIDs")
	})

	t.Run("should handle special characters in folder titles", func(t *testing.T) {
		specialTitles := []string{
			"folder/with/slashes",
			"folder with spaces",
			"folder-with-dashes",
			"folder_with_underscores",
			"folder.with.dots",
			"!@#$%^&*()",
		}

		for _, title := range specialTitles {
			t.Run(title, func(t *testing.T) {
				uid, err := generateAlertingFolderUID(title, "parent123", orgID)
				require.NoError(t, err)
				require.True(t, util.IsValidShortUID(uid), "Generated UID should be valid")
			})
		}
	})
}
