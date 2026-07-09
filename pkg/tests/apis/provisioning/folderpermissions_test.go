package provisioning

import (
	"fmt"
	"net/http"
	"testing"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"
)

// We currently block permission updates for folders managed by provisioning.
func TestIntegrationFolderPermissions_ProvisionedFolders(t *testing.T) {
	repoName := "nested-folder-repo"
	helper := sharedHelper(t)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:            repoName,
		SyncTarget:      "folder",
		ExpectedFolders: 1,
		Copies: map[string]string{
			"testdata/all-panels.json": "folder/subfolder/dashboard.json",
		},
		SkipResourceAssertions: true,
	})
	t.Run("should fail to update permissions for provisioned nested folder", func(t *testing.T) {
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
		Name:            repo,
		SyncTarget:      "folder",
		ExpectedFolders: 1,
	})

	t.Run("should update permissions when folder is released", func(t *testing.T) {
		folders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, folders.Items, 1)
		managedFolderName := folders.Items[0].GetName()
		require.Contains(t, folders.Items[0].GetAnnotations(), utils.AnnoKeyManagerKind, "folder should be managed")
		require.Contains(t, folders.Items[0].GetAnnotations(), utils.AnnoKeyManagerIdentity, "folder should be managed")

		_, err = helper.Repositories.Resource.Patch(t.Context(), repo, types.JSONPatchType, []byte(`[
		{
			"op": "replace",
			"path": "/metadata/finalizers",
			"value": ["cleanup", "release-orphan-resources"]
		}
		]`), metav1.PatchOptions{})
		require.NoError(t, err, "should successfully patch finalizers")

		require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), repo, metav1.DeleteOptions{}))
		helper.WaitForRepositoryDeleted(t, t.Context(), repo)
		common.WaitForResourcesReleased(t, t.Context(), helper.Folders.Resource, "folders")

		permissionsPayload := map[string]interface{}{
			"items": []map[string]interface{}{
				{
					"role":       "Viewer",
					"permission": 1, // View permission
				},
			},
		}
		permissionsURL := fmt.Sprintf("/api/folders/%s/permissions", managedFolderName)
		permissionsData, code, err := common.PostHelper(t, *helper.K8sTestHelper, permissionsURL, permissionsPayload, helper.Org1.Admin)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, code)
		require.NotNil(t, permissionsData)
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

		unmanagedFolderName := createdFolder.GetName()
		permissionsPayload := map[string]interface{}{
			"items": []map[string]interface{}{
				{
					"role":       "Editor",
					"permission": 2, // Edit permission
				},
			},
		}
		permissionsURL := fmt.Sprintf("/api/folders/%s/permissions", unmanagedFolderName)
		permissionsData, code, err := common.PostHelper(t, *helper.K8sTestHelper, permissionsURL, permissionsPayload, helper.Org1.Admin)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, code)
		require.NotNil(t, permissionsData)
	})
}
