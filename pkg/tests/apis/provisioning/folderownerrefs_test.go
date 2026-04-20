package provisioning

import (
	"testing"
	"time"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"
)

var ownerRefsPatch = []byte(`[{
	"op": "add",
	"path": "/metadata/ownerReferences",
	"value": [{
		"apiVersion": "iam.grafana.app/v0alpha1",
		"kind": "Team",
		"name": "test-team",
		"uid": "00000000-0000-0000-0000-000000000001"
	}]
}]`)

func TestIntegrationFolderOwnerRefs_ProvisionedFolders(t *testing.T) {
	helper := sharedHelper(t)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:            "test-repo",
		SyncTarget:      "folder",
		ExpectedFolders: 1,
	})

	t.Run("should fail to set ownerReferences on provisioned folder via patch", func(t *testing.T) {
		folders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, folders.Items, 1)

		managedFolder := folders.Items[0]
		require.Contains(t, managedFolder.GetAnnotations(), utils.AnnoKeyManagerKind, "folder should be managed")
		require.Contains(t, managedFolder.GetAnnotations(), utils.AnnoKeyManagerIdentity, "folder should be managed")

		_, err = helper.Folders.Resource.Patch(t.Context(), managedFolder.GetName(), types.JSONPatchType, ownerRefsPatch, metav1.PatchOptions{})
		require.Error(t, err, "should fail to set ownerReferences on managed folder")
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden status error, got: %v", err)
		require.Contains(t, err.Error(), "cannot set owner references on folders managed by a repository")
	})

	t.Run("should fail to set ownerReferences on provisioned folder via update", func(t *testing.T) {
		folders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, folders.Items, 1)

		managedFolder := folders.Items[0].DeepCopy()
		managedFolder.SetOwnerReferences([]metav1.OwnerReference{{
			APIVersion: "iam.grafana.app/v0alpha1",
			Kind:       "Team",
			Name:       "test-team",
			UID:        "00000000-0000-0000-0000-000000000001",
		}})

		_, err = helper.Folders.Resource.Update(t.Context(), managedFolder, metav1.UpdateOptions{})
		require.Error(t, err, "should fail to set ownerReferences on managed folder via update")
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden status error, got: %v", err)
		require.Contains(t, err.Error(), "cannot set owner references on folders managed by a repository")
	})
}

func TestIntegrationFolderOwnerRefs_UnprovisionedFolders(t *testing.T) {
	const repo = "test-repo"
	helper := sharedHelper(t)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:            repo,
		SyncTarget:      "folder",
		ExpectedFolders: 1,
	})

	t.Run("should set ownerReferences when folder is released", func(t *testing.T) {
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

		_, err = helper.Folders.Resource.Patch(t.Context(), managedFolderName, types.JSONPatchType, ownerRefsPatch, metav1.PatchOptions{})
		require.NoError(t, err, "should set ownerReferences on released folder")

		updated, err := helper.Folders.Resource.Get(t.Context(), managedFolderName, metav1.GetOptions{})
		require.NoError(t, err)
		require.Len(t, updated.GetOwnerReferences(), 1, "ownerReferences should be persisted")
		require.Equal(t, "Team", updated.GetOwnerReferences()[0].Kind)
		require.Equal(t, "test-team", updated.GetOwnerReferences()[0].Name)
	})

	t.Run("should set ownerReferences on unmanaged folder", func(t *testing.T) {
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

		_, err = helper.Folders.Resource.Patch(t.Context(), createdFolder.GetName(), types.JSONPatchType, ownerRefsPatch, metav1.PatchOptions{})
		require.NoError(t, err, "should set ownerReferences on unmanaged folder")

		updated, err := helper.Folders.Resource.Get(t.Context(), createdFolder.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.Len(t, updated.GetOwnerReferences(), 1, "ownerReferences should be persisted")
		require.Equal(t, "Team", updated.GetOwnerReferences()[0].Kind)
		require.Equal(t, "test-team", updated.GetOwnerReferences()[0].Name)
	})
}
