package jobs

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_JobPendingDeleteLabel_SkipsExecution verifies that
// when a repository carries the pending-delete label a submitted job is claimed by
// the driver but exits early without performing any real work.
//
// The observable proof is that a pull job does NOT delete a Grafana dashboard even
// though the backing file has been removed from disk – something a real pull would do.
func TestIntegrationProvisioning_JobPendingDeleteLabel_SkipsExecution(t *testing.T) {
	helper := sharedHelper(t)

	const repoName = "pending-delete-skip-job"

	// Create a local repository with one dashboard and run the initial sync so
	// the resource is present in Grafana.
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:               repoName,
		SyncTarget:         "folder",
		ExpectedDashboards: 1,
		ExpectedFolders:    1, // folder sync creates a root folder for the repository
		Copies: map[string]string{
			"../testdata/all-panels.json": "dashboard.json",
		},
	})

	// Remove the file from disk. A real pull job would propagate this deletion to
	// Grafana; a skipped job must leave the dashboard intact.
	err := os.Remove(filepath.Join(helper.ProvisioningPath, "dashboard.json"))
	require.NoError(t, err)

	// Label the repository as pending-delete before submitting the job.
	repoObj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err)

	labels := repoObj.GetLabels()
	if labels == nil {
		labels = make(map[string]string)
	}
	labels[appcontroller.LabelPendingDelete] = "true"
	repoObj.SetLabels(labels)

	_, err = helper.Repositories.Resource.Update(t.Context(), repoObj, metav1.UpdateOptions{})
	require.NoError(t, err)

	// Submit a pull job. Without the pending-delete skip this would sync the
	// repository and delete the dashboard that no longer exists on disk.
	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	// The job must still complete (not hang or error), but it was skipped so
	// state should be a warning with no actual work done.
	jobState := common.MustNestedString(job.Object, "status", "state")
	require.Equal(t, string(provisioning.JobStateWarning), jobState,
		"skipped job should complete with a warning")

	// The dashboard must still exist because the pull was skipped.
	dashboards, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, dashboards.Items, 1,
		"dashboard should be preserved because the pull job was skipped")

	// Sanity-check: removing the label lets the next pull run normally and remove
	// the dashboard that is no longer on disk.
	repoObj, err = helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err)

	labels = repoObj.GetLabels()
	delete(labels, appcontroller.LabelPendingDelete)
	repoObj.SetLabels(labels)

	_, err = helper.Repositories.Resource.Update(t.Context(), repoObj, metav1.UpdateOptions{})
	require.NoError(t, err)

	helper.TriggerJobAndWaitForSuccess(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	dashboards, err = helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Empty(t, dashboards.Items,
		"dashboard should be deleted once the pull job runs without the pending-delete label (the repository root folder remains)")
}
