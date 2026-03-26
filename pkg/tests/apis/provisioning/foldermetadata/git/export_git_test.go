package git

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	k8sruntime "k8s.io/apimachinery/pkg/runtime"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func createUnmanagedFolder(t *testing.T, helper *common.ProvisioningTestHelper, name, title string) {
	t.Helper()
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "folder.grafana.app/v1beta1",
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

// TestIntegrationProvisioning_ExportJob_GitRepo_FolderFiles verifies the files
// committed to a git repository when exporting Grafana folders, depending on
// the provisioningFolderMetadata feature flag.
//
//   - Flag disabled: each exported folder must contain a .keep placeholder so
//     git can track the otherwise-empty directory.
//   - Flag enabled: each exported folder must contain a _folder.json manifest
//     (no .keep file).
func TestIntegrationProvisioning_ExportJob_GitRepo_FolderFiles(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("flag disabled creates .keep files for exported folders", func(t *testing.T) {
		helper := common.RunGrafanaWithGitServerForExport(t)
		ctx := context.Background()

		const repoName = "git-export-no-meta"
		helper.CreateGitRepo(t, repoName)

		createUnmanagedFolder(t, helper.ProvisioningTestHelper, "git-no-meta-uid", "git-no-meta-folder")

		job := triggerExport(t, helper.ProvisioningTestHelper, repoName)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		// Without the feature flag git cannot track an empty directory, so a
		// .keep placeholder must be committed inside every exported folder.
		// The files API rejects hidden-file paths, so we verify via the Gitea raw API.
		require.True(t, helper.GitFileExists(t, ctx, repoName, "git-no-meta-folder/.keep"),
			".keep file must be committed for an exported folder when the feature flag is disabled")

		// No _folder.json must be present when the flag is off.
		_, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", "git-no-meta-folder/_folder.json")
		require.True(t, apierrors.IsNotFound(err), "_folder.json must not exist when the feature flag is disabled")
	})

	t.Run("flag enabled creates _folder.json instead of .keep for exported folders", func(t *testing.T) {
		helper := common.RunGrafanaWithGitServerForExport(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const (
			repoName    = "git-export-with-meta"
			folderUID   = "git-meta-uid"
			folderTitle = "git-meta-folder"
		)
		helper.CreateGitRepo(t, repoName)

		createUnmanagedFolder(t, helper.ProvisioningTestHelper, folderUID, folderTitle)

		job := triggerExport(t, helper.ProvisioningTestHelper, repoName)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		// With the feature flag enabled, a _folder.json manifest must be committed instead of
		// a bare .keep placeholder.  Read the file directly from the Gitea server to avoid the
		// ownership-conflict check that the provisioning files API performs on unmanaged resources.
		data := helper.GitReadFile(t, ctx, repoName, folderTitle+"/_folder.json")

		var manifest foldersV1.Folder
		require.NoError(t, json.Unmarshal(data, &manifest), "_folder.json must be valid JSON")
		require.Equal(t, folderUID, manifest.Name, "_folder.json must carry the folder's stable UID")
		require.Equal(t, folderTitle, manifest.Spec.Title, "_folder.json must carry the folder's title")

		// No .keep file must be present when _folder.json is written.
		require.False(t, helper.GitFileExists(t, ctx, repoName, folderTitle+"/.keep"),
			".keep must not exist when the feature flag is enabled")
	})
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}
