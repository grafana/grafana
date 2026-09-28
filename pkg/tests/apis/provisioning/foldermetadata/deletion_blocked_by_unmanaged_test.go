package foldermetadata

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_RepositoryDeletionBlockedByUnmanagedResources
// reproduces mixed ownership inside a managed folder: a selective migrate takes
// ownership of the folder and one dashboard while a sibling dashboard stays
// unmanaged. Deleting the repository then removes the managed dashboard but the
// folder API refuses to delete the non-empty folder, so status.deletion names
// that folder. Removing the unmanaged dashboard lets the retry complete.
func TestIntegrationProvisioning_RepositoryDeletionBlockedByUnmanagedResources(t *testing.T) {
	helper := sharedHelper(t)

	const (
		repo        = "mixed-owner-repo"
		folderUID   = "mixed-owner-folder"
		folderTitle = "Mixed owner folder"
	)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Workflows:  []string{"write"},
	})

	helper.CreateUnmanagedFolderWithName(t, folderUID, folderTitle, "")
	selected := helper.CreateUnmanagedDashboard(t, "Selected dashboard", folderUID)
	unmanaged := helper.CreateUnmanagedDashboard(t, "Unmanaged sibling", folderUID)

	helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{
			Resources: []provisioning.ResourceRef{{
				Name:  selected,
				Kind:  "Dashboard",
				Group: "dashboard.grafana.app",
			}},
		},
	})

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		folder, err := helper.Folders.Resource.Get(t.Context(), folderUID, metav1.GetOptions{})
		if assert.NoError(collect, err) {
			assert.Equal(collect, repo, folder.GetAnnotations()[utils.AnnoKeyManagerIdentity], "folder should be managed")
		}
		dash, err := helper.DashboardsV1.Resource.Get(t.Context(), selected, metav1.GetOptions{})
		if assert.NoError(collect, err) {
			assert.Equal(collect, repo, dash.GetAnnotations()[utils.AnnoKeyManagerIdentity], "selected dashboard should be managed")
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "migrate should take ownership of the folder and selected dashboard")

	sibling, err := helper.DashboardsV1.Resource.Get(t.Context(), unmanaged, metav1.GetOptions{})
	require.NoError(t, err)
	require.Empty(t, sibling.GetAnnotations()[utils.AnnoKeyManagerIdentity], "sibling dashboard should stay unmanaged")

	require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), repo, metav1.DeleteOptions{}))

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		status := common.MustFromUnstructured[provisioning.Repository](t, obj).Status
		if !assert.NotNil(collect, status.Deletion, "deletion status should be populated") {
			return
		}
		assert.Equal(collect, provisioning.DeletionStateBlocked, status.Deletion.State)
		assert.Equal(collect, repository.RemoveOrphanResourcesFinalizer, status.Deletion.Finalizer)
		assert.Contains(collect, status.Deletion.Message, `"`+folderTitle+`" (UID: `+folderUID+`)`)
		assert.Contains(collect, status.Deletion.Message, "blocked by unmanaged resources")
		assert.Equal(collect, status.Deletion.Message, status.DeleteError)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "deletion status should name the blocked folder")

	_, err = helper.DashboardsV1.Resource.Get(t.Context(), selected, metav1.GetOptions{})
	require.Error(t, err, "managed dashboard should have been deleted")
	_, err = helper.Folders.Resource.Get(t.Context(), folderUID, metav1.GetOptions{})
	require.NoError(t, err, "blocked folder should still exist")

	require.NoError(t, helper.DashboardsV1.Resource.Delete(t.Context(), unmanaged, metav1.DeleteOptions{}))
	helper.TriggerRepositoryReconciliation(t, repo)
	helper.WaitForRepositoryDeleted(t, repo)

	_, err = helper.Folders.Resource.Get(t.Context(), folderUID, metav1.GetOptions{})
	require.Error(t, err, "folder should be deleted once it is empty")
}
