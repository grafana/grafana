package repository

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_CleanupAllResourcesRemovesOrphans guards the cleanup every test starts
// with: resources left behind by a repository that is gone cannot be deleted directly, so the cleanup has
// to run the orphan cleanup job, as the UI does, or it would fail every test that follows.
func TestIntegrationProvisioning_CleanupAllResourcesRemovesOrphans(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "cleanup-removes-orphans"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		Template:   common.TestdataPath("github.json.tmpl"),
		SyncTarget: "folder",
		Workflows:  []string{},
	})
	helper.RequireRepoDashboardCount(t, repo, 3)
	helper.RequireRepoFolderCount(t, repo, 6)

	// Keep only the cleanup finalizer, so the repository goes away and its resources stay.
	_, err := helper.Repositories.Resource.Patch(t.Context(), repo, types.JSONPatchType, []byte(`[
		{"op": "replace", "path": "/metadata/finalizers", "value": ["cleanup"]}
	]`), metav1.PatchOptions{})
	require.NoError(t, err)
	require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), repo, metav1.DeleteOptions{}))
	helper.WaitForRepositoryDeleted(t, repo)

	folders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)
	require.NotEmpty(t, folders.Items, "the orphaned folders should still be there")

	helper.CleanupAllResources(t)

	folders, err = helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Empty(t, folders.Items)
	dashboards, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Empty(t, dashboards.Items)
}
