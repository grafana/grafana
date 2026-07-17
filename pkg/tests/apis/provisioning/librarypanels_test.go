package provisioning

import (
	"fmt"
	"net/http"
	"testing"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// waitForSingleFolder waits until the repo's folder is listable and returns it.
// The folder List is served by the eventually-consistent search index, which
// can briefly report zero right after an initial sync completes — even though
// CreateLocalRepo already observed the folder — so callers must poll rather
// than read once.
func waitForSingleFolder(t *testing.T, helper *common.ProvisioningTestHelper, repo string) *unstructured.Unstructured {
	t.Helper()
	helper.RequireRepoFolderCount(t, repo, 1)
	return &helper.ListRepoFolders(t, repo)[0]
}

// We currently block the creation of library panels in provisioned folders.
func TestIntegrationLibraryPanels_ProvisionedFolders(t *testing.T) {
	helper := sharedHelper(t)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       "test-repo",
		SyncTarget: "folder",
	})

	helper.RequireRepoDashboardCount(t, "test-repo", 0)
	helper.RequireRepoFolderCount(t, "test-repo", 1)

	t.Run("should fail to create library element in provisioned folder", func(t *testing.T) {
		managedFolderName := waitForSingleFolder(t, helper, "test-repo").GetName()
		libraryElement := map[string]interface{}{
			"kind":      1,
			"name":      "Library Panel",
			"folderUid": managedFolderName,
			"model": map[string]interface{}{
				"type":  "text",
				"title": "Library Panel",
			},
		}
		libraryElementURL := "/api/library-elements"
		libraryElementData, code, err := common.PostHelper(t, *helper.K8sTestHelper, libraryElementURL, libraryElement, helper.Org1.Admin)
		require.Error(t, err)
		require.Equal(t, http.StatusConflict, code)
		require.NotNil(t, libraryElementData)
		require.Equal(t, "resource type not supported in repository-managed folders", libraryElementData["message"])
	})

	t.Run("should fail to patch library element, moving it in a provisioned folder", func(t *testing.T) {
		// Getting managed folder
		managedFolderName := waitForSingleFolder(t, helper, "test-repo").GetName()

		unmanagedFolder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "test-folder-",
				},
				"spec": map[string]interface{}{
					"title": "Library Panel",
				},
			},
		}
		createdFolder, err := helper.Folders.Resource.Create(t.Context(), unmanagedFolder, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, createdFolder)

		libraryElement := map[string]interface{}{
			"kind":      1,
			"name":      "Moved Library Panel",
			"folderUid": createdFolder.GetName(),
			"model": map[string]interface{}{
				"type":  "text",
				"title": "Moved Library Panel",
			},
		}
		libraryElementURL := "/api/library-elements"
		libraryElementData, code, err := common.PostHelper(t, *helper.K8sTestHelper, libraryElementURL, libraryElement, helper.Org1.Admin)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, code)
		require.NotNil(t, libraryElementData)

		res := libraryElementData["result"].(map[string]interface{})
		t.Cleanup(func() {
			deleteURL := fmt.Sprintf("/api/library-elements/%s", res["uid"].(string))
			common.DeleteHelper(t, *helper.K8sTestHelper, deleteURL, helper.Org1.Admin)
		})
		helper.SetPermissions(helper.Org1.Admin, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{"library.panels:write"},
				Resource:          "library.panels",
				ResourceAttribute: "uid",
				ResourceID:        "*",
			},
		})

		// Patching libraryElement - changing folder to a managed one
		updatedLibraryElement := map[string]interface{}{
			"kind":      1,
			"version":   res["version"],
			"folderUid": managedFolderName,
		}
		patchLibraryElementURL := fmt.Sprintf("/api/library-elements/%f", +res["id"].(float64))
		newLibraryElement, code, err := common.PatchHelper(t, *helper.K8sTestHelper, patchLibraryElementURL, updatedLibraryElement, helper.Org1.Admin)
		require.Error(t, err)
		require.Equal(t, http.StatusConflict, code)
		require.NotNil(t, newLibraryElement)
		require.Equal(t, "resource type not supported in repository-managed folders", newLibraryElement["message"])
	})
}

func TestIntegrationLibraryPanels_UnprovisionedFolders(t *testing.T) {
	const repo = "test-repo"
	helper := sharedHelper(t)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
	})

	helper.RequireRepoDashboardCount(t, repo, 0)
	helper.RequireRepoFolderCount(t, repo, 1)

	t.Run("should create library element when folder is released", func(t *testing.T) {
		managedFolder := waitForSingleFolder(t, helper, repo)
		managedFolderName := managedFolder.GetName()
		require.Contains(t, managedFolder.GetAnnotations(), utils.AnnoKeyManagerKind, "folder should be managed")
		require.Contains(t, managedFolder.GetAnnotations(), utils.AnnoKeyManagerIdentity, "folder should be managed")

		helper.ReleaseAndDeleteRepository(t, repo)
		common.WaitForResourcesReleased(t, helper.Folders.Resource, "folders")

		libraryElement := map[string]interface{}{
			"kind":      1,
			"name":      "Library Panel",
			"folderUid": managedFolderName,
			"model": map[string]interface{}{
				"type":  "text",
				"title": "Library Panel",
			},
		}
		libraryElementURL := "/api/library-elements"
		libraryElementData, code, err := common.PostHelper(t, *helper.K8sTestHelper, libraryElementURL, libraryElement, helper.Org1.Admin)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, code)
		require.NotNil(t, libraryElementData)

		res := libraryElementData["result"].(map[string]interface{})
		t.Cleanup(func() {
			deleteURL := fmt.Sprintf("/api/library-elements/%s", res["uid"].(string))
			common.DeleteHelper(t, *helper.K8sTestHelper, deleteURL, helper.Org1.Admin)
		})
	})
}
