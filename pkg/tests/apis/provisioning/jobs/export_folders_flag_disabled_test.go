package jobs

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	k8sruntime "k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func createUnmanagedFolder(t *testing.T, helper *common.ProvisioningTestHelper, name, title string) {
	t.Helper()
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "folder.grafana.app/v1",
			"kind":       "Folder",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": "default",
			},
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}
	_, err := helper.Folders.Resource.Create(t.Context(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
}

func createUnmanagedFolderWithParent(t *testing.T, helper *common.ProvisioningTestHelper, name, title, parentUID string) {
	t.Helper()
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "folder.grafana.app/v1",
			"kind":       "Folder",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": "default",
				"annotations": map[string]interface{}{
					"grafana.app/folder": parentUID,
				},
			},
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}
	_, err := helper.Folders.Resource.Create(t.Context(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
}

func triggerExport(t *testing.T, helper *common.ProvisioningTestHelper, repo string) *provisioning.Job {
	t.Helper()
	result := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push:   &provisioning.ExportJobOptions{},
	})
	jobObj := &provisioning.Job{}
	err := k8sruntime.DefaultUnstructuredConverter.FromUnstructured(result.Object, jobObj)
	require.NoError(t, err, "should be able to decode job status")
	return jobObj
}

// TestIntegrationProvisioning_ExportJob_FolderMetadataFlagDisabled verifies that
// _folder.json files are NOT written during an export when the flag is disabled.
func TestIntegrationProvisioning_ExportJob_FolderMetadataFlagDisabled(t *testing.T) {
	t.Run("flag disabled does not create folder metadata", func(t *testing.T) {
		helper := sharedHelper(t)

		const repo = "export-no-meta-repo"
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:                   repo,
			SyncTarget:             "instance",
			Workflows:              []string{"write"},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		createUnmanagedFolder(t, helper, "no-meta-folder-uid", "no-meta-folder")

		job := triggerExport(t, helper, repo)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		require.DirExists(t, filepath.Join(helper.ProvisioningPath, "no-meta-folder"), "folder directory must be created by export")

		// The folder directory may be created, but _folder.json must not be present.
		metadataPath := filepath.Join(helper.ProvisioningPath, "no-meta-folder", "_folder.json")
		_, err := os.Stat(metadataPath)
		require.True(t, os.IsNotExist(err), "_folder.json must not be written when the feature flag is disabled")
	})

	t.Run("flag disabled does not create folder metadata for nested folders", func(t *testing.T) {
		helper := sharedHelper(t)

		const repo = "nested-no-meta-repo"
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:                   repo,
			SyncTarget:             "instance",
			Workflows:              []string{"write"},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		const (
			parentUID   = "nested-no-meta-parent-uid"
			parentTitle = "nested-no-meta-parent"
			childUID    = "nested-no-meta-child-uid"
			childTitle  = "nested-no-meta-child"
		)
		createUnmanagedFolder(t, helper, parentUID, parentTitle)
		createUnmanagedFolderWithParent(t, helper, childUID, childTitle, parentUID)

		job := triggerExport(t, helper, repo)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		require.DirExists(t, filepath.Join(helper.ProvisioningPath, parentTitle), "parent folder directory must be created by export")
		require.DirExists(t, filepath.Join(helper.ProvisioningPath, parentTitle, childTitle), "child folder directory must be created by export")

		_, err := os.Stat(filepath.Join(helper.ProvisioningPath, parentTitle, "_folder.json"))
		require.True(t, os.IsNotExist(err), "parent _folder.json must not be written when the feature flag is disabled")

		_, err = os.Stat(filepath.Join(helper.ProvisioningPath, parentTitle, childTitle, "_folder.json"))
		require.True(t, os.IsNotExist(err), "child _folder.json must not be written when the feature flag is disabled")
	})
}
