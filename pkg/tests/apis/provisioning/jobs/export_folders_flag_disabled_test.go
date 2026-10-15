package jobs

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	k8sruntime "k8s.io/apimachinery/pkg/runtime"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

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

func TestIntegrationProvisioning_ExportJob_FolderMetadata(t *testing.T) {
	requireFolderMetadata := func(t *testing.T, folderPath, uid, title string) {
		t.Helper()
		data, err := os.ReadFile(filepath.Join(folderPath, "_folder.json")) //nolint:gosec
		require.NoError(t, err)
		var manifest foldersV1.Folder
		require.NoError(t, json.Unmarshal(data, &manifest))
		require.Equal(t, uid, manifest.Name)
		require.Equal(t, title, manifest.Spec.Title)
		require.NoFileExists(t, filepath.Join(folderPath, ".keep"))
	}

	t.Run("creates folder metadata", func(t *testing.T) {
		helper := sharedHelper(t)

		const repo = "export-meta-repo"
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "instance",
			Workflows:  []string{"write"},
			SkipSync:   true,
		})

		const (
			folderUID   = "export-meta-folder-uid"
			folderTitle = "export-meta-folder"
		)
		helper.CreateUnmanagedFolderWithName(t, folderUID, folderTitle, "")

		job := triggerExport(t, helper, repo)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		requireFolderMetadata(t, filepath.Join(helper.ProvisioningPath, folderTitle), folderUID, folderTitle)
	})

	t.Run("creates folder metadata for nested folders", func(t *testing.T) {
		helper := sharedHelper(t)

		const repo = "nested-meta-repo"
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "instance",
			Workflows:  []string{"write"},
			SkipSync:   true,
		})

		const (
			parentUID   = "nested-meta-parent-uid"
			parentTitle = "nested-meta-parent"
			childUID    = "nested-meta-child-uid"
			childTitle  = "nested-meta-child"
		)
		helper.CreateUnmanagedFolderWithName(t, parentUID, parentTitle, "")
		helper.CreateUnmanagedFolderWithName(t, childUID, childTitle, parentUID)

		job := triggerExport(t, helper, repo)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		requireFolderMetadata(t, filepath.Join(helper.ProvisioningPath, parentTitle), parentUID, parentTitle)
		requireFolderMetadata(t, filepath.Join(helper.ProvisioningPath, parentTitle, childTitle), childUID, childTitle)
	})
}
