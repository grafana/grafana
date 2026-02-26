package provisioning

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_ClassicDashboardDeletion verifies that classic-format dashboards
// (JSON without apiVersion/kind) can be properly deleted during incremental sync.
// This is a regression test for a bug where RemoveResourceFromFile only tried DecodeYAMLObject
// and lacked the ReadClassicResource fallback, causing "no object found" errors when deleting
// classic dashboards.
func TestIntegrationProvisioning_ClassicDashboardDeletion(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)

	t.Run("classic dashboard deleted via filesystem removal and sync", func(t *testing.T) {
		const repo = "classic-delete-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)

		helper.CreateRepo(t, TestRepo{
			Name:   repo,
			Path:   repoPath,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "dashboard1.json",
			},
			SkipResourceAssertions: true,
		})

		// Verify the classic dashboard was created (all-panels.json has uid "n1jR8vnnz")
		helper.RequireRepoDashboardCount(t, repo, 1)
		_, err := helper.DashboardsV1.Resource.Get(t.Context(), "n1jR8vnnz", metav1.GetOptions{})
		require.NoError(t, err, "classic dashboard should exist after initial sync")

		// Delete the classic dashboard file from the filesystem
		err = os.Remove(filepath.Join(repoPath, "dashboard1.json"))
		require.NoError(t, err, "should be able to delete file")

		// Trigger sync - incremental sync should detect the deletion and remove the resource
		helper.SyncAndWait(t, repo, nil)

		// Verify the dashboard was deleted from Grafana
		helper.RequireRepoDashboardCount(t, repo, 0)
	})

	t.Run("inline classic dashboard deleted via filesystem removal and sync", func(t *testing.T) {
		const repo = "classic-inline-delete-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)

		// Write a minimal classic dashboard directly (no testdata file)
		classicDashboard := []byte(`{
			"uid": "inline-classic-uid",
			"title": "Inline Classic Dashboard",
			"schemaVersion": 39,
			"panels": [],
			"tags": []
		}`)

		err := os.MkdirAll(repoPath, 0o750)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(repoPath, "inline-classic.json"), classicDashboard, 0o600)
		require.NoError(t, err)

		helper.CreateRepo(t, TestRepo{
			Name:                   repo,
			Path:                   repoPath,
			Target:                 "folder",
			SkipResourceAssertions: true,
		})

		// Verify the dashboard was created
		helper.RequireRepoDashboardCount(t, repo, 1)
		_, err = helper.DashboardsV1.Resource.Get(t.Context(), "inline-classic-uid", metav1.GetOptions{})
		require.NoError(t, err, "inline classic dashboard should exist after initial sync")

		// Delete the file
		err = os.Remove(filepath.Join(repoPath, "inline-classic.json"))
		require.NoError(t, err, "should be able to delete file")

		// Trigger sync - this should succeed without "no object found" errors
		helper.SyncAndWait(t, repo, nil)

		// Verify the dashboard was removed
		helper.RequireRepoDashboardCount(t, repo, 0)
	})

	t.Run("sync job succeeds without errors when classic dashboard is deleted", func(t *testing.T) {
		const repo = "classic-delete-status-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)

		classicDashboard := []byte(`{
			"uid": "status-check-uid",
			"title": "Status Check Dashboard",
			"schemaVersion": 39,
			"panels": [],
			"tags": []
		}`)

		err := os.MkdirAll(repoPath, 0o750)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(repoPath, "status-check.json"), classicDashboard, 0o600)
		require.NoError(t, err)

		helper.CreateRepo(t, TestRepo{
			Name:                   repo,
			Path:                   repoPath,
			Target:                 "folder",
			SkipResourceAssertions: true,
		})

		helper.RequireRepoDashboardCount(t, repo, 1)

		// Delete the file
		err = os.Remove(filepath.Join(repoPath, "status-check.json"))
		require.NoError(t, err)

		// Trigger sync and verify the job succeeds (not warning/error state)
		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		jobObj := &provisioning.Job{}
		err = runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		require.Equal(t, provisioning.JobStateSuccess, jobObj.Status.State,
			"sync job should succeed when deleting a classic dashboard, got state=%s errors=%v",
			jobObj.Status.State, jobObj.Status.Errors)
		require.Empty(t, jobObj.Status.Errors, "should have no errors when deleting classic dashboard")

		helper.RequireRepoDashboardCount(t, repo, 0)
	})

	t.Run("mixed k8s and classic dashboards deleted together", func(t *testing.T) {
		const repo = "mixed-delete-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)

		// Classic dashboard (no apiVersion/kind)
		classicDashboard := []byte(`{
			"uid": "mixed-classic-uid",
			"title": "Mixed Classic Dashboard",
			"schemaVersion": 39,
			"panels": [],
			"tags": []
		}`)

		// K8s-formatted dashboard (has apiVersion/kind)
		k8sDashboard := []byte(`{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind": "Dashboard",
			"metadata": {
				"name": "mixed-k8s-uid"
			},
			"spec": {
				"title": "Mixed K8s Dashboard",
				"schemaVersion": 39,
				"panels": [],
				"tags": []
			}
		}`)

		err := os.MkdirAll(repoPath, 0o750)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(repoPath, "classic.json"), classicDashboard, 0o600)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(repoPath, "k8s.json"), k8sDashboard, 0o600)
		require.NoError(t, err)

		helper.CreateRepo(t, TestRepo{
			Name:                   repo,
			Path:                   repoPath,
			Target:                 "folder",
			SkipResourceAssertions: true,
		})

		// Verify both dashboards were created
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			count := 0
			dashboards, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
			if !assert.NoError(collect, err) {
				return
			}
			for _, d := range dashboards.Items {
				name := d.GetName()
				if name == "mixed-classic-uid" || name == "mixed-k8s-uid" {
					count++
				}
			}
			assert.Equal(collect, 2, count, "both dashboards should exist")
		}, waitTimeoutDefault, waitIntervalDefault, "both dashboards should be created")

		// Delete both files
		err = os.Remove(filepath.Join(repoPath, "classic.json"))
		require.NoError(t, err)
		err = os.Remove(filepath.Join(repoPath, "k8s.json"))
		require.NoError(t, err)

		// Sync should handle both deletions
		helper.SyncAndWait(t, repo, nil)

		helper.RequireRepoDashboardCount(t, repo, 0)
	})
}
