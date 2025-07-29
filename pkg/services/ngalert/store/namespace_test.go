package store

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
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
	folderService := foldertest.NewFakeService()
	b := &fakeBus{}
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)

	admin := &user.SignedInUser{
		UserID:         1,
		OrgID:          1,
		OrgRole:        org.RoleAdmin,
		IsGrafanaAdmin: true,
	}

	folders := []*folder.Folder{
		{UID: uuid.NewString(), Title: "folder1", ParentUID: "", OrgID: 1},
		{UID: uuid.NewString(), Title: "folder2", ParentUID: "", OrgID: 1},
		{UID: uuid.NewString(), Title: "nested/folder", ParentUID: "", OrgID: 1},
	}

	for _, f := range folders {
		folderService.AddFolder(f)
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

func TestGetNamespaceByTitle(t *testing.T) {
	folderService := foldertest.NewFakeService()
	folderService.ExpectedError = dashboards.ErrFolderNotFound
	store := DBstore{
		FolderService: folderService,
	}
	_, err := store.GetNamespaceByTitle(context.Background(), "Test Folder", 1, nil, folder.RootFolderUID)
	require.Error(t, err)
	require.ErrorIs(t, err, dashboards.ErrFolderNotFound)

	// note: most tests are in /pkg/tests/api/alerting/api_namespace_test.go
}

func TestGetOrCreateNamespaceByTitle(t *testing.T) {
	store := DBstore{}
	_, err := store.GetOrCreateNamespaceByTitle(context.Background(), "", 1, nil, folder.RootFolderUID)
	require.Error(t, err)
	require.Contains(t, err.Error(), "title is empty")

	// note: most tests are in /pkg/tests/api/alerting/api_namespace_test.go
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
