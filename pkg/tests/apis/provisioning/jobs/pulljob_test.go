package jobs

import (
	"context"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_PullJobOwnershipProtection(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo1 = "pulljob-repo-1"
	const repo2 = "pulljob-repo-2"

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo1,
		LocalPath:  path.Join(helper.ProvisioningPath, "repo1"),
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json": "dashboard1.json",
		},
		SkipResourceAssertions: true, // will check both at the same time below
	})
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo2,
		LocalPath:  path.Join(helper.ProvisioningPath, "repo2"),
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/timeline-demo.json": "dashboard2.json",
		},
		SkipResourceAssertions: true, // will check both at the same time below
	})

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		dashboards, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
		if err != nil {
			collect.Errorf("could not list dashboards error: %s", err.Error())
			return
		}
		if len(dashboards.Items) != 2 {
			collect.Errorf("should have the expected dashboards after sync. got: %d. expected: %d", len(dashboards.Items), 2)
			return
		}
		folders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		if err != nil {
			collect.Errorf("could not list folders: error: %s", err.Error())
			return
		}
		if len(folders.Items) != 2 {
			collect.Errorf("should have the expected folders after sync. got: %d. expected: %d", len(folders.Items), 2)
			return
		}

		assert.Len(collect, dashboards.Items, 2)
		assert.Len(collect, folders.Items, 2)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "should have the expected dashboards and folders after sync")

	// Test: Pull job should fail when trying to manage resources owned by another repository
	t.Run("pull job should fail when trying to manage resources owned by another repository", func(t *testing.T) {
		// Step 1: Try to add a file with the same UID as repo1's dashboard to repo2's directory
		// This simulates a scenario where repo2 tries to manage a resource that repo1 already owns
		const allPanelsUID = "n1jR8vnnz" // UID from all-panels.json (owned by repo1)

		// Copy the same file (same UID) to repo2's directory to create ownership conflict
		conflictingFilePath := "repo2/conflicting-dashboard.json"
		helper.CopyToProvisioningPath(t, "../testdata/all-panels.json", conflictingFilePath)
		common.PrintFileTree(t, helper.ProvisioningPath)

		// Step 2: Try to pull repo2 - should fail due to ownership conflict
		job := helper.TriggerJobAndWaitForComplete(t, repo2, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		// Step 3: Verify the job completed with warning due to ownership conflict
		jobObj := &provisioning.Job{}
		err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		// The job completes with "warning" state for ownership conflicts (they are treated as warnings)
		t.Logf("Job state: %s", jobObj.Status.State)
		t.Logf("Job warnings: %v", jobObj.Status.Warnings)

		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State, "job should complete with warning due to ownership conflicts")
		require.NotEmpty(t, jobObj.Status.Warnings, "should have warning details")
		require.Empty(t, jobObj.Status.Errors, "ownership conflicts should be warnings, not errors")

		// Check that warning mentions ownership conflict
		found := false
		for _, warningMsg := range jobObj.Status.Warnings {
			t.Logf("Warning message: %s", warningMsg)
			if strings.Contains(warningMsg, fmt.Sprintf("managed by repo '%s'", repo1)) &&
				strings.Contains(warningMsg, fmt.Sprintf("cannot be modified by repo '%s'", repo2)) {
				found = true
				break
			}
		}
		require.True(t, found, "should have ownership conflict warning")

		// Step 4: Verify original resource is still owned by repo1 and unchanged
		originalDashboard, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		require.NoError(t, err, "original dashboard should still exist")
		require.Equal(t, repo1, originalDashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity], "ownership should remain with repo1")

		// Clean up the conflicting file for subsequent tests
		err = os.Remove(filepath.Join(helper.ProvisioningPath, conflictingFilePath))
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
		require.Equal(t, repo2Dashboard.GetGeneration(), persistentRepo2Dashboard.GetGeneration(), "repo2's resource should not be modified by repo1 pull")

		// Step 4: Pull repo2 and verify repo1's resource is still intact
		helper.TriggerJobAndWaitForSuccess(t, repo2, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		persistentRepo1Dashboard, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		require.NoError(t, err, "repo1's dashboard should still exist after repo2 pull")
		require.Equal(t, repo1, persistentRepo1Dashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity], "ownership should remain with repo1")
		require.Equal(t, repo1Dashboard.GetGeneration(), persistentRepo1Dashboard.GetGeneration(), "repo1's resource should not be modified by repo2 pull")
	})
}

// Reproduces the "Delete and keep resources" → reconnect-with-same-name flow
// for a folder-target repository. The first repo's release finalizer strips
// manager annotations from the root folder; the second repo (same name) then
// collides with that orphan. The pull job must surface the conflict as a
// per-resource validation warning so operators can see the cause, instead of
// hard-failing the whole job. The orphan must not be silently adopted.
func TestIntegrationProvisioning_PullJobUnmanagedRootConflict(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "unmanaged-root-repo"
	repoPath := path.Join(helper.ProvisioningPath, "unmanaged-root-repo-data")

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:            repo,
		LocalPath:       repoPath,
		SyncTarget:      "folder",
		ExpectedFolders: 1,
	})

	rootFolder, err := helper.Folders.Resource.Get(ctx, repo, metav1.GetOptions{})
	require.NoError(t, err, "root folder should exist after initial sync")
	require.Equal(t, repo, rootFolder.GetAnnotations()[utils.AnnoKeyManagerIdentity],
		"root folder should be managed by the repo")

	// Mimic "Delete and keep resources" from the UI: ensure the
	// release-orphan-resources finalizer is set, then delete the repo.
	_, err = helper.Repositories.Resource.Patch(ctx, repo, types.JSONPatchType, []byte(`[
		{"op": "replace", "path": "/metadata/finalizers", "value": ["cleanup", "release-orphan-resources"]}
	]`), metav1.PatchOptions{})
	require.NoError(t, err, "should patch finalizers")

	require.NoError(t, helper.Repositories.Resource.Delete(ctx, repo, metav1.DeleteOptions{}))
	helper.WaitForRepositoryDeleted(t, ctx, repo)
	common.WaitForResourcesReleased(t, ctx, helper.Folders.Resource, "folders")

	orphan, err := helper.Folders.Resource.Get(ctx, repo, metav1.GetOptions{})
	require.NoError(t, err, "orphan root folder should still exist after release")
	require.NotContains(t, orphan.GetAnnotations(), utils.AnnoKeyManagerIdentity,
		"orphan folder must have manager annotations stripped")
	require.NotContains(t, orphan.GetAnnotations(), utils.AnnoKeyManagerKind,
		"orphan folder must have manager annotations stripped")

	// Recreate a repository with the same name. SkipSync so we can trigger
	// and inspect the pull job ourselves rather than racing the helper's
	// initial sync.
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		LocalPath:              repoPath,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	t.Logf("Job state: %s", jobObj.Status.State)
	t.Logf("Job warnings: %v", jobObj.Status.Warnings)
	t.Logf("Job errors: %v", jobObj.Status.Errors)

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"unmanaged-root conflict should be a warning, not a hard failure")
	require.Empty(t, jobObj.Status.Errors, "no hard errors expected")
	require.NotEmpty(t, jobObj.Status.Warnings, "should record a warning describing the conflict")

	found := false
	for _, w := range jobObj.Status.Warnings {
		if strings.Contains(w, repo) && strings.Contains(w, "already exists and is not managed") {
			found = true
			break
		}
	}
	require.True(t, found, "warning should describe the unmanaged conflict on the root folder")

	// Defensive: the orphan folder must not have been silently adopted by
	// the recreated repository. The whole point of the existing guard is
	// that takeover requires explicit migration.
	orphan, err = helper.Folders.Resource.Get(ctx, repo, metav1.GetOptions{})
	require.NoError(t, err, "orphan root folder should still exist")
	require.NotContains(t, orphan.GetAnnotations(), utils.AnnoKeyManagerIdentity,
		"orphan folder must not be silently adopted by the recreated repo")
}
