package repository

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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

	// Keep only the cleanup finalizer, so the repository goes away and its resources stay.
	_, err := helper.Repositories.Resource.Patch(t.Context(), repo, types.JSONPatchType, []byte(`[
		{"op": "replace", "path": "/metadata/finalizers", "value": ["cleanup"]}
	]`), metav1.PatchOptions{})
	require.NoError(t, err)
	require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), repo, metav1.DeleteOptions{}))
	helper.WaitForRepositoryDeleted(t, repo)
}

// TestIntegrationProvisioning_CleanupAllResourcesRemovesOrphans guards the cleanup every test starts
// with: resources left behind by a repository that is gone cannot be deleted directly, so the cleanup has
// to run the orphan cleanup job, as the UI does, or it would fail every test that follows.
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

// TestIntegrationProvisioning_DeleteOrphanReportsMissingRepository guards what deleteAndWait relies on.
// Deleting a resource whose repository is gone returns a NotFound, which a caller usually reads as
// "already deleted". The details of that NotFound name the repository, so a caller can tell that the
// resource itself is still there.
func TestIntegrationProvisioning_DeleteOrphanReportsMissingRepository(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "orphan-delete-details"
	orphanRepository(t, helper, repo)

	dashboards, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)
	require.NotEmpty(t, dashboards.Items)
	dashboard := dashboards.Items[0]
	require.Equal(t, repo, dashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity])

	err = helper.DashboardsV1.Resource.Delete(t.Context(), dashboard.GetName(), metav1.DeleteOptions{})

	statusErr, ok := errors.AsType[*apierrors.StatusError](err)
	require.True(t, ok, "expected a StatusError, got %T: %v", err, err)
	status := statusErr.ErrStatus
	require.Equal(t, metav1.StatusReasonNotFound, status.Reason)
	require.NotNil(t, status.Details)
	require.Equal(t, provisioning.RepositoryResourceInfo.GroupResource().Group, status.Details.Group)
	require.Equal(t, provisioning.RepositoryResourceInfo.GroupResource().Resource, status.Details.Kind)
	require.Equal(t, repo, status.Details.Name)
}
