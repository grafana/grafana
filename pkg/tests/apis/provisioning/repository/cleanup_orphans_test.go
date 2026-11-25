package repository

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// orphanRepository syncs a folder-target repository, then deletes it while keeping its resources.
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
	deleteRepositoryKeepResources(t, helper, repo)
}

// deleteRepositoryKeepResources keeps only the cleanup finalizer, so the repository goes away and its
// resources stay.
func deleteRepositoryKeepResources(t *testing.T, helper *common.ProvisioningTestHelper, repo string) {
	t.Helper()
	patch := fmt.Appendf(nil, `[{"op":"replace","path":"/metadata/finalizers","value":[%q]}]`, repository.CleanFinalizer)
	_, err := helper.Repositories.Resource.Patch(t.Context(), repo, types.JSONPatchType, patch, metav1.PatchOptions{})
	require.NoError(t, err)
	require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), repo, metav1.DeleteOptions{}))
	helper.WaitForRepositoryDeleted(t, repo)
}

// TestIntegrationProvisioning_CleanupAllResourcesRemovesOrphans guards the cleanup every test starts
// with: it has to remove the resources that a repository which is gone left behind, or it would fail
// every test that follows.
func TestIntegrationProvisioning_CleanupAllResourcesRemovesOrphans(t *testing.T) {
	helper := sharedHelper(t)

	orphanRepository(t, helper, "cleanup-removes-orphans")

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

// TestIntegrationProvisioning_DeleteOrphanRemovesOnlyThatResource guards that deleting a resource whose
// repository is gone removes the resource itself. The delete used to return a NotFound that named the
// repository and left the resource behind.
func TestIntegrationProvisioning_DeleteOrphanRemovesOnlyThatResource(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "orphan-delete-details"
	orphanRepository(t, helper, repo)

	dashboards, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, dashboards.Items, 3)
	dashboard := dashboards.Items[0]
	require.Equal(t, repo, dashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity])

	require.NoError(t, helper.DashboardsV1.Resource.Delete(t.Context(), dashboard.GetName(), metav1.DeleteOptions{}))

	helper.RequireDashboardsNotFound(t, dashboard.GetName())
	remaining, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, remaining.Items, 2, "the other orphans should be untouched")
}
