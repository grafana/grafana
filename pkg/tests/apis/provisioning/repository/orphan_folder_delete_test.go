package repository

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// orphanRepository syncs a repository with a folder target, then deletes it with only the cleanup
// finalizer, so its resources outlive it.
func orphanRepository(t *testing.T, helper *common.ProvisioningTestHelper, repo string) {
	t.Helper()
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		Template:   common.TestdataPath("github.json.tmpl"),
		SyncTarget: "folder",
		Workflows:  []string{},
	})
	helper.RequireRepoDashboardCount(t, repo, 3)
	helper.RequireRepoFolderCount(t, repo, 6)

	_, err := helper.Repositories.Resource.Patch(t.Context(), repo, types.JSONPatchType, []byte(`[
		{"op": "replace", "path": "/metadata/finalizers", "value": ["cleanup"]}
	]`), metav1.PatchOptions{})
	require.NoError(t, err)
	require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), repo, metav1.DeleteOptions{}))
	helper.WaitForRepositoryDeleted(t, repo)
}

func TestIntegrationProvisioning_DeleteRootFolderOfLiveRepository(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "root-folder-live"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		Template:   common.TestdataPath("github.json.tmpl"),
		SyncTarget: "folder",
		Workflows:  []string{},
	})
	helper.RequireRepoFolderCount(t, repo, 6)

	err := helper.Folders.Resource.Delete(t.Context(), repo, metav1.DeleteOptions{})
	require.Error(t, err)
	require.True(t, apierrors.IsForbidden(err), "got: %v", err)
	require.Contains(t, err.Error(), "managed by repository", "the error should say the folder is managed")
	require.NotContains(t, err.Error(), "source path")

	_, err = helper.Folders.Resource.Get(t.Context(), repo, metav1.GetOptions{})
	require.NoError(t, err, "the root folder must still exist")
}

func TestIntegrationProvisioning_DeleteOrphanedFolderQueuesCleanup(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "orphaned-folder-cleanup"
	orphanRepository(t, helper, repo)

	require.NoError(t, helper.Folders.Resource.Delete(t.Context(), repo, metav1.DeleteOptions{}),
		"the delete is accepted and the cleanup job is queued")

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.Folders.Resource.Get(t.Context(), repo, metav1.GetOptions{})
		assert.True(c, apierrors.IsNotFound(err), "the cleanup job should remove the root folder, got: %v", err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	helper.RequireRepoDashboardCount(t, repo, 0)
}

func TestIntegrationProvisioning_EditorCannotQueueOrphanCleanup(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "orphaned-folder-editor"
	orphanRepository(t, helper, repo)

	editorFolders := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Editor,
		Namespace: "default",
		GVR:       helper.Folders.Args.GVR,
	})

	err := editorFolders.Resource.Delete(t.Context(), repo, metav1.DeleteOptions{})
	require.Error(t, err)
	require.True(t, apierrors.IsForbidden(err), "got: %v", err)
	require.Contains(t, err.Error(), "repositories.provisioning.grafana.app is forbidden",
		"the rejection should come from the orphan cleanup authorization")

	_, err = helper.Folders.Resource.Get(t.Context(), repo, metav1.GetOptions{})
	require.NoError(t, err, "the root folder must still exist")
	helper.RequireRepoDashboardCount(t, repo, 3)

	// An admin can run the cleanup. This also removes what the orphaned repository left behind, so it
	// does not block the cleanup that follows every test.
	require.NoError(t, helper.Folders.Resource.Delete(t.Context(), repo, metav1.DeleteOptions{}))
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.Folders.Resource.Get(t.Context(), repo, metav1.GetOptions{})
		assert.True(c, apierrors.IsNotFound(err), "got: %v", err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
	helper.RequireRepoDashboardCount(t, repo, 0)
}
