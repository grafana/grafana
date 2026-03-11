package git

import (
	"strings"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

// TODO(ferruvich): use the one in `common` once https://github.com/grafana/grafana/pull/119801 is merged
func withProvisioningFolderMetadata(opts *testinfra.GrafanaOpts) {
	opts.EnableFeatureToggles = append(opts.EnableFeatureToggles, featuremgmt.FlagProvisioningFolderMetadata)
}

func TestIntegrationProvisioning_IncrementalSync_MissingFolderMetadata_FlagEnabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("detects missing folder metadata after adding file to folder", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, withProvisioningFolderMetadata)

		const repoName = "incr-missing-meta-add"

		_, local := helper.createGitRepo(t, repoName, map[string][]byte{
			"dashboard.json": dashboardJSON("root-dash", "Root Dashboard", 1),
		})

		// Full sync the root dashboard.
		helper.syncAndWait(t, repoName)

		// Add a dashboard inside a folder that has no _folder.json.
		require.NoError(t, local.CreateFile("myfolder/dashboard2.json", string(dashboardJSON("folder-dash", "Folder Dashboard", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add dashboard in folder without metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		// Trigger incremental sync.
		job := helper.triggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Empty(t, jobObj.Status.Errors,
			"missing folder metadata should produce warnings, not errors")
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"incremental sync should finish in warning state when folder metadata is missing")
		require.NotEmpty(t, jobObj.Status.Warnings,
			"incremental sync should produce at least one warning for missing folder metadata")
		requireJobWarningContains(t, jobObj, "missing folder metadata")
	})

	t.Run("noop incremental sync still detects missing metadata", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, withProvisioningFolderMetadata)

		const repoName = "incr-missing-meta-noop"

		// Seed with a folder that has no _folder.json.
		helper.createGitRepo(t, repoName, map[string][]byte{
			"myfolder/dashboard.json": dashboardJSON("noop-dash", "Noop Dashboard", 1),
		})

		// Full sync (should produce a warning about missing metadata).
		helper.syncAndWait(t, repoName)

		// Trigger incremental sync with no new commits — same ref.
		job := helper.triggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Empty(t, jobObj.Status.Errors,
			"noop incremental sync should not produce errors")
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"noop incremental sync should still warn about missing folder metadata")
		require.NotEmpty(t, jobObj.Status.Warnings,
			"noop incremental sync should still produce warnings for missing folder metadata")

		found := false
		for _, w := range jobObj.Status.Warnings {
			if strings.Contains(w, "missing folder metadata") {
				found = true
				break
			}
		}
		require.True(t, found,
			"expected at least one warning containing 'missing folder metadata', got: %v", jobObj.Status.Warnings)
	})
}

func TestIntegrationProvisioning_IncrementalSync_MissingFolderMetadata_FlagDisabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t) // no withProvisioningFolderMetadata

	const repoName = "incr-missing-meta-disabled"

	_, local := helper.createGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": dashboardJSON("disabled-dash", "Root Dashboard", 1),
	})

	// Full sync.
	helper.syncAndWait(t, repoName)

	// Add a dashboard inside a folder with no _folder.json.
	require.NoError(t, local.CreateFile("myfolder/dashboard2.json", string(dashboardJSON("disabled-folder-dash", "Folder Dashboard", 1))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "add dashboard in folder without metadata")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	// Trigger incremental sync.
	job := helper.triggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: true},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	require.Empty(t, jobObj.Status.Errors,
		"incremental sync with flag disabled should produce no errors")
	require.Equal(t, provisioning.JobStateSuccess, jobObj.Status.State,
		"incremental sync should succeed without warnings when flag is disabled")

	// Ensure no warning about missing folder metadata.
	for _, w := range jobObj.Status.Warnings {
		require.False(t, strings.Contains(w, "missing folder metadata"),
			"should not warn about missing folder metadata when flag is disabled, got: %s", w)
	}
}
