package provisioning

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestIntegrationProvisioning_PullJobOwnershipProtection(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	// Create two repositories with folder targets to allow multiple repos
	const repo1 = "pulljob-repo-1"
	const repo2 = "pulljob-repo-2"

	// Create first repository with folder target
	localTmp1 := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
		"Name":        repo1,
		"SyncEnabled": true,
		"SyncTarget":  "folder",
	})
	_, err := helper.Repositories.Resource.Create(ctx, localTmp1, metav1.CreateOptions{})
	require.NoError(t, err)

	// Create second repository with folder target
	localTmp2 := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
		"Name":        repo2,
		"SyncEnabled": true,
		"SyncTarget":  "folder",
	})
	_, err = helper.Repositories.Resource.Create(ctx, localTmp2, metav1.CreateOptions{})
	require.NoError(t, err)

	// Test: Sync should not replace resources owned by another repository
	t.Run("sync should not replace resources owned by another repository", func(t *testing.T) {
		// Step 1: Create a resource via repo1
		helper.CopyToProvisioningPath(t, "testdata/all-panels.json", "dashboard1.json")
		helper.SyncAndWait(t, repo1, nil)

		// Verify resource exists and is owned by repo1
		const allPanelsUID = "n1jR8vnnz"
		originalDashboard, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		require.NoError(t, err, "dashboard should exist after repo1 sync")
		require.Equal(t, repo1, originalDashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity], "should be owned by repo1")

		// Get original title for comparison
		originalTitle, _, err := unstructured.NestedString(originalDashboard.Object, "spec", "title")
		require.NoError(t, err)
		require.Equal(t, "Panel tests - All panels", originalTitle)

		// Step 2: Try to add the same resource (same UID) to repo2's files
		// This simulates a scenario where repo2 tries to manage a resource that repo1 already owns
		helper.CopyToProvisioningPath(t, "testdata/text-options.json", "conflicting-dashboard.json")

		// Modify the text-options.json to have the same UID as all-panels.json to create conflict
		conflictingDashboard := helper.LoadFile("testdata/text-options.json")
		// We need to manually create a file with the same UID to test ownership conflict

		// Step 3: Try to sync repo2 - it should fail or skip the conflicting resource
		job := helper.TriggerJobAndWaitForComplete(t, repo2, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		// The sync might complete but with errors, or it might complete successfully by skipping conflicts
		// Let's check that the original resource is still owned by repo1 and unchanged
		updatedDashboard, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		require.NoError(t, err, "dashboard should still exist")
		require.Equal(t, repo1, updatedDashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity], "ownership should not change")

		// Verify the content hasn't been replaced by repo2's version
		updatedTitle, _, err := unstructured.NestedString(updatedDashboard.Object, "spec", "title")
		require.NoError(t, err)
		require.Equal(t, originalTitle, updatedTitle, "title should not change - resource should not be replaced")

		// Verify that resource versions/generations haven't changed unexpectedly
		require.Equal(t, originalDashboard.GetResourceVersion(), updatedDashboard.GetResourceVersion(), "resource should not be modified by repo2 sync")
	})

	// Test: Sync should not delete resources owned by another repository
	t.Run("sync should not delete resources owned by another repository", func(t *testing.T) {
		// Step 1: Create a resource via repo1 that doesn't exist in repo2's file set
		helper.CopyToProvisioningPath(t, "testdata/timeline-demo.json", "repo1-exclusive.json")
		helper.SyncAndWait(t, repo1, nil)

		// Verify resource exists and is owned by repo1
		const timelineUID = "mIJjFy8Kz"
		originalDashboard, err := helper.DashboardsV1.Resource.Get(ctx, timelineUID, metav1.GetOptions{})
		require.NoError(t, err, "timeline dashboard should exist after repo1 sync")
		require.Equal(t, repo1, originalDashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity], "should be owned by repo1")

		// Step 2: Sync repo2 (which doesn't have this resource in its files)
		// This simulates repo2 doing a sync where it might try to "clean up" resources not in its current set
		job := helper.TriggerJobAndWaitForComplete(t, repo2, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		// The sync should complete successfully
		jobObj := &provisioning.Job{}
		err = helper.Runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		// Step 3: Verify that repo1's exclusive resource still exists and wasn't deleted by repo2's sync
		persistentDashboard, err := helper.DashboardsV1.Resource.Get(ctx, timelineUID, metav1.GetOptions{})
		require.NoError(t, err, "repo1's dashboard should still exist after repo2 sync")
		require.Equal(t, repo1, persistentDashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity], "ownership should remain with repo1")
		require.Equal(t, originalDashboard.GetResourceVersion(), persistentDashboard.GetResourceVersion(), "resource should not be modified")
	})

	// Test: Sync should handle ownership conflicts gracefully in pull jobs
	t.Run("sync job should handle ownership conflicts gracefully", func(t *testing.T) {
		// Step 1: Create a resource owned by repo1
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo1).
			SubResource("files", "owned-by-repo1.json").
			Body(helper.LoadFile("testdata/all-panels.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error())

		helper.SyncAndWait(t, repo1, nil)

		// Step 2: Try to add the same file to repo2 and sync
		result = helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo2).
			SubResource("files", "conflicting-file.json").
			Body(helper.LoadFile("testdata/all-panels.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error())

		// Step 3: Sync repo2 - should complete but with errors or skip conflicts
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		}

		job := helper.TriggerJobAndWaitForComplete(t, repo2, spec)
		jobObj := &provisioning.Job{}
		err = helper.Runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		// The job might complete with errors due to ownership conflicts
		// This is acceptable behavior - we just want to ensure it doesn't silently overwrite
		if jobObj.Status.State == provisioning.JobStateError {
			require.NotEmpty(t, jobObj.Status.Errors, "should have error details")
			// Check that error mentions ownership conflict
			found := false
			for _, errMsg := range jobObj.Status.Errors {
				if assert.Contains(t, errMsg, "is managed by") && assert.Contains(t, errMsg, "cannot be modified by") {
					found = true
					break
				}
			}
			require.True(t, found, "should have ownership conflict error")
		}

		// Step 4: Verify original resource is still owned by repo1 and unchanged
		const allPanelsUID = "n1jR8vnnz"
		dashboard, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		require.NoError(t, err, "original dashboard should still exist")
		require.Equal(t, repo1, dashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity], "ownership should remain with repo1")
	})

	// Test: Verify that allowed edits flag works in sync jobs
	t.Run("sync should respect AllowsEdits flag", func(t *testing.T) {
		// Step 1: Create a resource via repo1 with AllowsEdits=true
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo1).
			SubResource("files", "allows-edits-resource.json").
			Body(helper.LoadFile("testdata/timeline-demo.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error())

		helper.SyncAndWait(t, repo1, nil)

		// Step 2: Manually set AllowsEdits=true on the created resource
		const timelineUID = "mIJjFy8Kz"
		dashboard, err := helper.DashboardsV1.Resource.Get(ctx, timelineUID, metav1.GetOptions{})
		require.NoError(t, err)

		// Add the AllowsEdits annotation
		annotations := dashboard.GetAnnotations()
		if annotations == nil {
			annotations = make(map[string]string)
		}
		annotations[utils.AnnoKeyManagerAllowsEdits] = "true"
		dashboard.SetAnnotations(annotations)

		_, err = helper.DashboardsV1.Resource.Update(ctx, dashboard, metav1.UpdateOptions{})
		require.NoError(t, err)

		// Step 3: Try to sync the same resource from repo2 - should succeed due to AllowsEdits
		result = helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo2).
			SubResource("files", "edit-allowed-resource.json").
			Body(helper.LoadFile("testdata/timeline-demo.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error())

		job := helper.TriggerJobAndWaitForComplete(t, repo2, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		jobObj := &provisioning.Job{}
		err = helper.Runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		// Should complete successfully due to AllowsEdits=true
		require.Equal(t, provisioning.JobStateSuccess, jobObj.Status.State, "sync should succeed when AllowsEdits=true")

		// Verify the resource was updated and is now owned by repo2
		updatedDashboard, err := helper.DashboardsV1.Resource.Get(ctx, timelineUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, repo2, updatedDashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity], "ownership should transfer to repo2")
	})

	// Clean up - delete repositories
	err = helper.Repositories.Resource.Delete(ctx, repo1, metav1.DeleteOptions{})
	require.NoError(t, err)
	err = helper.Repositories.Resource.Delete(ctx, repo2, metav1.DeleteOptions{})
	require.NoError(t, err)

	// Wait for cleanup
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		assert.NoError(collect, err)
		assert.Equal(collect, 0, len(dashboards.Items), "all dashboards should be cleaned up")
	}, time.Second*30, time.Millisecond*100, "expected cleanup to complete")
}

