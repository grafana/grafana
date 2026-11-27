package full

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	k8sruntime "k8s.io/apimachinery/pkg/runtime"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func triggerExport(t *testing.T, helper *common.GitTestHelper, repo string) *provisioning.Job {
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

func TestIntegrationProvisioning_ExportJob_GitRepo_FolderMetadata(t *testing.T) {
	helper := sharedGitHelper(t)

	const (
		repoName    = "git-export-meta"
		folderUID   = "git-meta-uid"
		folderTitle = "git-meta-folder"
	)
	helper.CreateExportGitRepo(t, repoName, nil)

	helper.CreateUnmanagedFolderWithName(t, folderUID, folderTitle, "")

	job := triggerExport(t, helper, repoName)
	require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

	// Read directly from Git because the files API checks ownership of unmanaged resources.
	data := helper.GitReadFile(t, repoName, folderTitle+"/_folder.json")
	var manifest foldersV1.Folder
	require.NoError(t, json.Unmarshal(data, &manifest))
	require.Equal(t, folderUID, manifest.Name)
	require.Equal(t, folderTitle, manifest.Spec.Title)
	require.False(t, helper.GitFileExists(t, repoName, folderTitle+"/.keep"),
		".keep must not exist when _folder.json is written")
}
