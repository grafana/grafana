package foldermetadata

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

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
		helper.RequireRepoFolderCount(t, repoName, 3) // root, folder, subfolder
		provisionedFolders := helper.ListRepoFolders(t, repoName)

		permissionsPayload := map[string]interface{}{
			"items": []map[string]interface{}{
				{
					"role":       "Viewer",
					"permission": 1, // View permission
				},
			},
		}

		// Test that permission updates succeed for all provisioned folders when the flag is enabled
		for _, folder := range provisionedFolders {
			folderName := folder.GetName()
			permissionsURL := fmt.Sprintf("/api/folders/%s/permissions", folderName)
			permissionsData, code, err := common.PostHelper(t, *helper.K8sTestHelper, permissionsURL, permissionsPayload, helper.Org1.Admin)
			require.NoError(t, err, "should succeed updating permissions for folder %s", folderName)
			require.Equal(t, http.StatusOK, code, "should return OK status for folder %s", folderName)
			require.NotNil(t, permissionsData, "should have response data for folder %s", folderName)
		}
	})
}
