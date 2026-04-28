package full

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	k8sruntime "k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func createUnmanagedFolder(t *testing.T, helper *common.GitTestHelper, name, title string) {
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

// TestIntegrationProvisioning_ExportJob_GitRepo_FolderMetadataDisabled verifies
// that when the provisioningFolderMetadata feature flag is disabled, each exported
// folder contains a .keep placeholder (no _folder.json).
func TestIntegrationProvisioning_ExportJob_GitRepo_FolderMetadataDisabled(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-export-no-meta"
	helper.CreateExportGitRepo(t, repoName)

	createUnmanagedFolder(t, helper, "git-no-meta-uid", "git-no-meta-folder")

	job := triggerExport(t, helper, repoName)
	require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

	// Without the feature flag git cannot track an empty directory, so a
	// .keep placeholder must be committed inside every exported folder.
	// The files API rejects hidden-file paths, so we verify via the git clone.
	require.True(t, helper.GitFileExists(t, ctx, repoName, "git-no-meta-folder/.keep"),
		".keep file must be committed for an exported folder when the feature flag is disabled")

	// No _folder.json must be present when the flag is off.
	_, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", "git-no-meta-folder/_folder.json")
	require.True(t, apierrors.IsNotFound(err), "_folder.json must not exist when the feature flag is disabled")
}
