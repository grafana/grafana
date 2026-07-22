package foldermetadata

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationFolderPermissions_ProvisionedFolders_WithFlag verifies that permission updates
// succeed for provisioned folders when the provisioningFolderMetadata feature flag is enabled.
func TestIntegrationFolderPermissions_ProvisionedFolders_WithFlag(t *testing.T) {
	repoName := "nested-folder-repo-flag"
	helper := sharedHelper(t)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repoName,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json": "folder/subfolder/dashboard.json",
		},
	})
	t.Run("should succeed updating permissions for provisioned nested folder when flag is enabled", func(t *testing.T) {
		provisionedFolders := helper.RequireRepoFolderCount(t, repoName, 3) // root, folder, subfolder

		// Test that permission updates succeed for all provisioned folders when the flag is enabled
		for _, folder := range provisionedFolders {
			common.SetFolderPermissions(t, helper, folder.GetName(), common.RolePermission{Role: "Viewer", Permission: common.FolderPermissionView})
		}
	})
}
