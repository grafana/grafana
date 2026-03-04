package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_FixFolderMetadataJob(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "fix-folder-metadata-test-repo"
	testRepo := TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json": "dashboard1.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    1,
	}
	helper.CreateRepo(t, testRepo)

	t.Run("job completes successfully", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionFixFolderMetadata,
		}

		job := helper.TriggerJobAndWaitForComplete(t, repo, spec)
		state := mustNestedString(job.Object, "status", "state")
		if state != "success" {
			// Print the error message for debugging
			if msg, ok := job.Object["status"].(map[string]interface{})["message"].(string); ok {
				t.Logf("Job error message: %s", msg)
			}
			if errs, ok := job.Object["status"].(map[string]interface{})["errors"].([]interface{}); ok {
				t.Logf("Job errors: %v", errs)
			}
		}
		require.Equal(t, "success", state, "fix-folder-metadata job should complete with success")
	})

	t.Run("job creates marker file even for local repos", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionFixFolderMetadata,
		}
		helper.TriggerJobAndWaitForSuccess(t, repo, spec)

		// Verify original file still exists unchanged
		_, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard1.json")
		require.NoError(t, err, "original file should still exist after job")

		// Verify dashboards are untouched
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, dashboards.Items, 1, "dashboard count should be unchanged after job")

		// Verify marker file was created in .grafana directory
		fileList, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files")
		require.NoError(t, err)

		// Extract items from the file list
		items, ok := fileList.Object["items"].([]interface{})
		require.True(t, ok, "files should have items array")

		// Check that a .grafana/folder-metadata-fixed-* file was created
		foundMarker := false
		for _, item := range items {
			itemMap, ok := item.(map[string]interface{})
			if !ok {
				continue
			}
			path, ok := itemMap["path"].(string)
			if !ok {
				continue
			}
			// Match the prefix (29 chars: ".grafana/folder-metadata-fixe")
			if len(path) > 29 && path[:29] == ".grafana/folder-metadata-fixe" {
				foundMarker = true
				break
			}
		}
		require.True(t, foundMarker, "marker file should be created in .grafana directory")
	})

	t.Run("job with explicit empty ref completes successfully", func(t *testing.T) {
		// Note: Local repos don't support custom refs/branches
		// This test verifies that explicit empty ref works
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionFixFolderMetadata,
			FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{
				Ref: "", // Explicitly empty - let repository determine default
			},
		}

		job := helper.TriggerJobAndWaitForComplete(t, repo, spec)
		state := mustNestedString(job.Object, "status", "state")
		require.Equal(t, "success", state, "fix-folder-metadata job with explicit empty ref should complete with success")
	})

	t.Run("job with empty options uses default ref", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action:            provisioning.JobActionFixFolderMetadata,
			FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{},
		}

		job := helper.TriggerJobAndWaitForComplete(t, repo, spec)
		state := mustNestedString(job.Object, "status", "state")
		require.Equal(t, "success", state, "fix-folder-metadata job with empty options should complete with success")
	})
}
