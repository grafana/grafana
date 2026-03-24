package git

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_IncrementalSync_MissingFolderMetadata_FlagEnabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("detects missing folder metadata after adding file to folder", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)

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
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)

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

// folderMetadataJSON generates a valid _folder.json payload with a stable UID and title.
func folderMetadataJSON(uid, title string) []byte {
	folder := map[string]any{
		"apiVersion": "folder.grafana.app/v1beta1",
		"kind":       "Folder",
		"metadata": map[string]any{
			"name": uid,
		},
		"spec": map[string]any{
			"title": title,
		},
	}
	data, _ := json.MarshalIndent(folder, "", "\t")
	return data
}

// requireRepoFolderTitle lists all folders managed by repoName and asserts that
// exactly one has the given title, returning its K8s name (UID).
func requireRepoFolderTitle(t *testing.T, h *gitTestHelper, ctx context.Context, repoName, expectedTitle string) string {
	t.Helper()
	var folderUID string
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := h.FoldersV1.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		for _, f := range list.Items {
			mgr, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId")
			if mgr != repoName {
				continue
			}
			title, _, _ := unstructured.NestedString(f.Object, "spec", "title")
			if title == expectedTitle {
				folderUID = f.GetName()
				return
			}
		}
		c.Errorf("no folder managed by %q with title %q found", repoName, expectedTitle)
	}, waitTimeoutDefault, waitIntervalDefault,
		"expected folder with title %q for repo %q", expectedTitle, repoName)
	return folderUID
}

// TestIntegrationProvisioning_IncrementalSync_FolderMetadataTitle verifies that
// incremental sync uses spec.title from _folder.json when creating folders.
func TestIntegrationProvisioning_IncrementalSync_FolderMetadataTitle(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("folder uses spec.title from _folder.json", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const repoName = "incr-meta-title"

		// Seed with a dashboard at root.
		_, local := helper.createGitRepo(t, repoName, map[string][]byte{
			"dashboard.json": dashboardJSON("root-dash", "Root Dashboard", 1),
		})
		helper.syncAndWait(t, repoName)

		// Push a folder with _folder.json that has a custom title different from the directory name.
		require.NoError(t, local.CreateFile("my-team/_folder.json", string(folderMetadataJSON("stable-uid-1", "My Team Display Name"))))
		require.NoError(t, local.CreateFile("my-team/dash.json", string(dashboardJSON("team-dash", "Team Dashboard", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add folder with custom metadata title")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		// Incremental sync.
		helper.syncAndWaitIncremental(t, repoName)

		// Verify the Grafana folder was created with the metadata title, not the directory name.
		requireRepoFolderTitle(t, helper, ctx, repoName, "My Team Display Name")
	})

	t.Run("folder falls back to directory name when spec.title is empty", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const repoName = "incr-meta-title-empty"

		_, local := helper.createGitRepo(t, repoName, map[string][]byte{
			"dashboard.json": dashboardJSON("root-dash-2", "Root Dashboard", 1),
		})
		helper.syncAndWait(t, repoName)

		// Push a folder with _folder.json that has an empty title — should fall back to dir name.
		require.NoError(t, local.CreateFile("reports/_folder.json", string(folderMetadataJSON("stable-uid-2", ""))))
		require.NoError(t, local.CreateFile("reports/dash.json", string(dashboardJSON("reports-dash", "Reports Dashboard", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add folder with empty metadata title")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.syncAndWaitIncremental(t, repoName)

		// Should use directory name "reports" as the title.
		requireRepoFolderTitle(t, helper, ctx, repoName, "reports")
	})

	t.Run("folder uses directory name when no _folder.json exists", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const repoName = "incr-meta-title-absent"

		_, local := helper.createGitRepo(t, repoName, map[string][]byte{
			"dashboard.json": dashboardJSON("root-dash-3", "Root Dashboard", 1),
		})
		helper.syncAndWait(t, repoName)

		// Push a folder without _folder.json.
		require.NoError(t, local.CreateFile("analytics/dash.json", string(dashboardJSON("analytics-dash", "Analytics Dashboard", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add folder without metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.syncAndWaitIncremental(t, repoName)

		// Should use directory name "analytics" as the title.
		requireRepoFolderTitle(t, helper, ctx, repoName, "analytics")
	})

	t.Run("nested folders use respective spec.title from _folder.json", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const repoName = "incr-meta-title-nested"

		_, local := helper.createGitRepo(t, repoName, map[string][]byte{
			"dashboard.json": dashboardJSON("root-dash-4", "Root Dashboard", 1),
		})
		helper.syncAndWait(t, repoName)

		// Push nested folders, each with their own _folder.json and custom titles.
		require.NoError(t, local.CreateFile("parent/_folder.json", string(folderMetadataJSON("parent-uid", "Parent Display"))))
		require.NoError(t, local.CreateFile("parent/child/_folder.json", string(folderMetadataJSON("child-uid", "Child Display"))))
		require.NoError(t, local.CreateFile("parent/child/dash.json", string(dashboardJSON("nested-dash", "Nested Dashboard", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add nested folders with custom metadata titles")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.syncAndWaitIncremental(t, repoName)

		// Both folders should use their metadata titles.
		requireRepoFolderTitle(t, helper, ctx, repoName, "Parent Display")
		requireRepoFolderTitle(t, helper, ctx, repoName, "Child Display")
	})
}
