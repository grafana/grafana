package provisioning

import (
	"context"
	"fmt"
	"os"
	"path"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestIntegrationProvisioning_PullJobOwnershipProtection(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	// Create two repositories with folder targets and separate paths to avoid file conflicts
	const repo1 = "pulljob-repo-1"
	const repo2 = "pulljob-repo-2"

	// Create first repository targeting "folder" with its own subdirectory
	helper.CreateRepo(t, TestRepo{
		Name:   repo1,
		Path:   path.Join(helper.ProvisioningPath, "repo1"),
		Target: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json": "dashboard1.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    1,
	})

	// Create second repository targeting "folder" with its own subdirectory
	helper.CreateRepo(t, TestRepo{
		Name:   repo2,
		Path:   path.Join(helper.ProvisioningPath, "repo2"),
		Target: "folder",
		Copies: map[string]string{
			"testdata/timeline-demo.json": "dashboard2.json",
		},
		ExpectedDashboards: 2, // Total across both repos
		ExpectedFolders:    2, // Total across both repos
	})

	// Test: Pull job should fail when trying to manage resources owned by another repository
	t.Run("pull job should fail when trying to manage resources owned by another repository", func(t *testing.T) {
		// Step 1: Try to add a file with the same UID as repo1's dashboard to repo2's directory
		// This simulates a scenario where repo2 tries to manage a resource that repo1 already owns
		const allPanelsUID = "n1jR8vnnz" // UID from all-panels.json (owned by repo1)

		// Copy the same file (same UID) to repo2's directory to create ownership conflict
		repo2DashboardPath := path.Join(helper.ProvisioningPath, "repo2", "conflicting-dashboard.json")
		helper.CopyToProvisioningPath(t, "testdata/all-panels.json", repo2DashboardPath)

		// Step 2: Try to pull repo2 - should fail due to ownership conflict
		job := helper.TriggerJobAndWaitForComplete(t, repo2, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		// Step 3: Verify the job failed with ownership conflict error
		jobObj := &provisioning.Job{}
		err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		// The job completes with "warning" state instead of "error" state when it doesn't have too many errors
		t.Logf("Job state: %s", jobObj.Status.State)
		t.Logf("Job errors: %v", jobObj.Status.Errors)

		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State, "job should complete with warnings due to ownership conflicts")
		require.NotEmpty(t, jobObj.Status.Errors, "should have error details")

		// Check that error mentions ownership conflict
		found := false
		for _, errMsg := range jobObj.Status.Errors {
			t.Logf("Error message: %s", errMsg)
			if assert.Contains(t, errMsg, fmt.Sprintf("managed by repo '%s'", repo1)) &&
				assert.Contains(t, errMsg, fmt.Sprintf("cannot be modified by repo '%s'", repo2)) {
				found = true
				break
			}
		}
		require.True(t, found, "should have ownership conflict error")

		// Step 4: Verify original resource is still owned by repo1 and unchanged
		originalDashboard, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		require.NoError(t, err, "original dashboard should still exist")
		require.Equal(t, repo1, originalDashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity], "ownership should remain with repo1")

		// Clean up the conflicting file for subsequent tests
		err = os.Remove(repo2DashboardPath)
		require.NoError(t, err, "should clean up conflicting file")
	})

	// Test: Repositories should not delete resources owned by other repositories during pull
	t.Run("repositories should not delete resources owned by other repositories during pull", func(t *testing.T) {
		// Both repositories were created with their own resources (repo1 has all-panels.json, repo2 has timeline-demo.json)
		// Verify that pulling one repository doesn't affect the other's resources

		// Step 1: Verify both repositories have their own resources
		const allPanelsUID = "n1jR8vnnz" // UID from all-panels.json (repo1)
		const timelineUID = "mIJjFy8Kz"  // UID from timeline-demo.json (repo2)

		repo1Dashboard, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		require.NoError(t, err, "repo1's dashboard should exist")
		require.Equal(t, repo1, repo1Dashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity], "should be owned by repo1")

		repo2Dashboard, err := helper.DashboardsV1.Resource.Get(ctx, timelineUID, metav1.GetOptions{})
		require.NoError(t, err, "repo2's dashboard should exist")
		require.Equal(t, repo2, repo2Dashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity], "should be owned by repo2")

		// Step 2: Pull repo1 (which doesn't manage repo2's resource) - should complete successfully
		helper.SyncAndWait(t, repo1, nil)

		// Step 3: Verify that repo2's resource is still intact after repo1's pull
		persistentRepo2Dashboard, err := helper.DashboardsV1.Resource.Get(ctx, timelineUID, metav1.GetOptions{})
		require.NoError(t, err, "repo2's dashboard should still exist after repo1 pull")
		require.Equal(t, repo2, persistentRepo2Dashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity], "ownership should remain with repo2")
		require.Equal(t, repo2Dashboard.GetResourceVersion(), persistentRepo2Dashboard.GetResourceVersion(), "repo2's resource should not be modified by repo1 pull")

		// Step 4: Pull repo2 and verify repo1's resource is still intact
		helper.SyncAndWait(t, repo2, nil)

		persistentRepo1Dashboard, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		require.NoError(t, err, "repo1's dashboard should still exist after repo2 pull")
		require.Equal(t, repo1, persistentRepo1Dashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity], "ownership should remain with repo1")
		require.Equal(t, repo1Dashboard.GetResourceVersion(), persistentRepo1Dashboard.GetResourceVersion(), "repo1's resource should not be modified by repo2 pull")
	})
}
