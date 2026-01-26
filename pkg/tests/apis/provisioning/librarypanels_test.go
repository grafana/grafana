package provisioning

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"
)

// We currently block the creation of library panels in provisioned folders.
func TestIntegrationLibraryPanels_ProvisionedFolders(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	helper.CreateRepo(t, TestRepo{
		Name:            "test-repo",
		Target:          "folder",
		ExpectedFolders: 1,
	})

	t.Run("should fail to create library element in provisioned folder", func(t *testing.T) {
		folders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, folders.Items, 1)

		managedFolderName := folders.Items[0].GetName()
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
		libraryElementData, code, err := postHelper(t, *helper.K8sTestHelper, libraryElementURL, libraryElement, helper.Org1.Admin)
		require.Error(t, err)
		require.Equal(t, http.StatusConflict, code)
		require.NotNil(t, libraryElementData)
		require.Equal(t, "resource type not supported in repository-managed folders", libraryElementData["message"])
	})

	t.Run("should fail to patch library element, moving it in a provisioned folder", func(t *testing.T) {
		// Getting managed folder
		folders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, folders.Items, 1)
		managedFolderName := folders.Items[0].GetName()

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
		libraryElementData, code, err := postHelper(t, *helper.K8sTestHelper, libraryElementURL, libraryElement, helper.Org1.Admin)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, code)
		require.NotNil(t, libraryElementData)

		res := libraryElementData["result"].(map[string]interface{})
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
		newLibraryElement, code, err := patchHelper(t, *helper.K8sTestHelper, patchLibraryElementURL, updatedLibraryElement, helper.Org1.Admin)
		require.Error(t, err)
		require.Equal(t, http.StatusConflict, code)
		require.NotNil(t, newLibraryElement)
		require.Equal(t, "resource type not supported in repository-managed folders", newLibraryElement["message"])
	})
}

func TestIntegrationLibraryPanels_UnprovisionedFolders(t *testing.T) {
	const repo = "test-repo"
	helper := runGrafana(t)
	helper.CreateRepo(t, TestRepo{
		Name:            repo,
		Target:          "folder",
		ExpectedFolders: 1,
	})

	t.Run("should create library element when folder is released", func(t *testing.T) {
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
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			_, err := helper.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{})
			assert.True(collect, apierrors.IsNotFound(err), "repository should be deleted")
		}, time.Second*10, time.Millisecond*50, "repository should be deleted")
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			foundFolders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
			require.NoError(t, err, "can list values")
			for _, v := range foundFolders.Items {
				assert.NotContains(t, v.GetAnnotations(), utils.AnnoKeyManagerKind)
				assert.NotContains(t, v.GetAnnotations(), utils.AnnoKeyManagerIdentity)
				assert.NotContains(t, v.GetAnnotations(), utils.AnnoKeySourcePath)
				assert.NotContains(t, v.GetAnnotations(), utils.AnnoKeySourceChecksum)
			}
		}, time.Second*20, time.Millisecond*10, "Expected folders to be released")

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
		libraryElementData, code, err := postHelper(t, *helper.K8sTestHelper, libraryElementURL, libraryElement, helper.Org1.Admin)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, code)
		require.NotNil(t, libraryElementData)
	})
}
