package foldermetadata

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationFolderPermissions_ProvisionedFolders_WithFlag verifies that permission updates
// succeed for provisioned folders when the provisioningFolderMetadata feature flag is enabled.
func TestIntegrationFolderPermissions_ProvisionedFolders_WithFlag(t *testing.T) {
	repoName := "nested-folder-repo-flag"
	helper := sharedHelper(t)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:            repoName,
		SyncTarget:      "folder",
		ExpectedFolders: 1,
		Copies: map[string]string{
			"../testdata/all-panels.json": "folder/subfolder/dashboard.json",
		},
		SkipResourceAssertions: true,
		// Initial sync warns because folder and folder/subfolder have no _folder.json metadata.
		InitialSyncExpectation: common.Warning(),
	})
	t.Run("should succeed updating permissions for provisioned nested folder when flag is enabled", func(t *testing.T) {
		folders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(folders.Items), 2, "should have 2 folders (root and nested)")

		// Find all folders managed by provisioning
		var provisionedFolders []*unstructured.Unstructured
		for i := range folders.Items {
			annotations := folders.Items[i].GetAnnotations()
			if _, hasManagerKind := annotations[utils.AnnoKeyManagerKind]; hasManagerKind {
				if _, hasManagerIdentity := annotations[utils.AnnoKeyManagerIdentity]; hasManagerIdentity {
					provisionedFolders = append(provisionedFolders, &folders.Items[i])
				}
			}
		}
		require.Greater(t, len(provisionedFolders), 0, "should have at least one provisioned folder")

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
