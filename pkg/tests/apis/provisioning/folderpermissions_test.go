package provisioning

import (
	"fmt"
	"net/http"
	"testing"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// We currently block permission updates for folders managed by provisioning.
func TestIntegrationFolderPermissions_ProvisionedFolders(t *testing.T) {
	repoName := "nested-folder-repo"
	helper := sharedHelper(t)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repoName,
		SyncTarget: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json": "folder/subfolder/dashboard.json",
		},
	})
	t.Run("should fail to update permissions for provisioned nested folder", func(t *testing.T) {
		provisionedFolders := helper.RequireRepoFolderCount(t, repoName, 3)

		permissionsPayload := map[string]interface{}{
			"items": []map[string]interface{}{
				{
					"role":       "Viewer",
					"permission": common.FolderPermissionView,
				},
			},
		}

		// Test that permission updates fail for all provisioned folders
		for _, folder := range provisionedFolders {
			folderName := folder.GetName()
			permissionsURL := fmt.Sprintf("/api/folders/%s/permissions", folderName)
			permissionsData, code, err := common.PostHelper(t, *helper.K8sTestHelper, permissionsURL, permissionsPayload, helper.Org1.Admin)
			require.Error(t, err, "should fail to update permissions for folder %s", folderName)
			require.Equal(t, http.StatusForbidden, code, "should return forbidden status for folder %s", folderName)
			require.NotNil(t, permissionsData, "should have error response for folder %s", folderName)
			require.Equal(t, "Cannot update permissions for folders managed by provisioning.", permissionsData["message"], "should have correct error message for folder %s", folderName)
		}
	})
}

func TestIntegrationFolderPermissions_UnprovisionedFolders(t *testing.T) {
	const repo = "test-repo"
	helper := sharedHelper(t)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
	})

	helper.RequireRepoDashboardCount(t, repo, 0)
	helper.RequireRepoFolderCount(t, repo, 1)

	t.Run("should update permissions when folder is released", func(t *testing.T) {
		managedFolderName := helper.RequireSingleRepoFolder(t, repo).GetName()

		helper.ReleaseAndDeleteRepository(t, repo)
		common.WaitForResourcesReleased(t, helper.Folders.Resource, "folders")

		common.SetFolderPermissions(t, helper, managedFolderName, common.RolePermission{Role: "Viewer", Permission: common.FolderPermissionView})
	})

	t.Run("should update permissions for unmanaged folder", func(t *testing.T) {
		unmanagedFolder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "test-folder-",
				},
				"spec": map[string]interface{}{
					"title": "Unmanaged Folder",
				},
			},
		}
		createdFolder, err := helper.Folders.Resource.Create(t.Context(), unmanagedFolder, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, createdFolder)

		common.SetFolderPermissions(t, helper, createdFolder.GetName(), common.RolePermission{Role: "Editor", Permission: common.FolderPermissionEdit})
	})
}
