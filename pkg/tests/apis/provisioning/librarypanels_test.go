package provisioning

import (
	"fmt"
	"net/http"
	"testing"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// We currently block the creation of library panels in provisioned folders.
func TestIntegrationLibraryPanels(t *testing.T) {
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
		require.Equal(t, "cannot create or move a library element on a provisioned folder", libraryElementData["message"])
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
		require.Equal(t, "cannot create or move a library element on a provisioned folder", newLibraryElement["message"])
	})
}
