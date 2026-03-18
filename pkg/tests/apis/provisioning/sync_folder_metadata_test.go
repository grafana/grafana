package provisioning

import (
	"encoding/json"
	"os"
	"path"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_FullSync_MissingFolderMetadata_FlagEnabled verifies that when the
// provisioningFolderMetadata feature flag is enabled, a full sync on a repository that has folders
// without _folder.json produces a warning job state and a MissingFolderMetadata condition reason.
func TestIntegrationProvisioning_FullSync_MissingFolderMetadata_FlagEnabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("single folder", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		const repo = "missing-folder-meta-single"
		helper.CreateRepo(t, common.TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				// Dashboard inside a folder that intentionally has no _folder.json
				"testdata/all-panels.json": "myfolder/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		jobObj := &provisioning.Job{}
		err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"job should complete with warning state when a folder is missing _folder.json")
		require.NotEmpty(t, jobObj.Status.Warnings, "job should have at least one warning")
		require.Empty(t, jobObj.Status.Errors, "missing _folder.json should be a warning, not an error")

		found := false
		for _, w := range jobObj.Status.Warnings {
			if strings.Contains(w, "missing folder metadata") {
				found = true
				break
			}
		}
		require.True(t, found, "a warning should mention missing folder metadata; warnings: %v", jobObj.Status.Warnings)

		helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonMissingFolderMetadata)
	})

	t.Run("multiple folders", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		const repo = "missing-folder-meta-multi"
		helper.CreateRepo(t, common.TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				// Two dashboards in separate folders, neither has a _folder.json
				"testdata/all-panels.json":    "folderA/dashboard1.json",
				"testdata/timeline-demo.json": "folderB/dashboard2.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		jobObj := &provisioning.Job{}
		err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"job should complete with warning state when folders are missing _folder.json")
		require.Empty(t, jobObj.Status.Errors, "missing _folder.json should be warnings, not errors")

		// Count warnings that mention missing folder metadata
		var metadataWarnings []string
		for _, w := range jobObj.Status.Warnings {
			if strings.Contains(w, "missing folder metadata") {
				metadataWarnings = append(metadataWarnings, w)
			}
		}
		require.GreaterOrEqual(t, len(metadataWarnings), 2,
			"expected at least 2 missing-folder-metadata warnings (one per folder); got: %v", metadataWarnings)

		// Verify both folders are mentioned
		joined := strings.Join(metadataWarnings, "\n")
		require.Contains(t, joined, "folderA", "warning should mention folderA")
		require.Contains(t, joined, "folderB", "warning should mention folderB")

		helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonMissingFolderMetadata)
	})

	t.Run("completed with warnings", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		const repo = "folder-meta-with-warnings"
		helper.CreateRepo(t, common.TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				// Dashboard in folder without _folder.json → MissingFolderMetadata
				"testdata/all-panels.json": "myfolder/dashboard.json",
				// Invalid dashboard at root → ResourceInvalid
				"testdata/dashboard-missing-name.json": "bad-dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		jobObj := &provisioning.Job{}
		err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
		require.Empty(t, jobObj.Status.Errors)

		// Should have warnings from both missing metadata and invalid resource
		hasMissingMeta := false
		hasResourceWarning := false
		for _, w := range jobObj.Status.Warnings {
			if strings.Contains(w, "missing folder metadata") {
				hasMissingMeta = true
			}
			if strings.Contains(w, "validation") || strings.Contains(w, "invalid") || strings.Contains(w, "writing resource") {
				hasResourceWarning = true
			}
		}
		require.True(t, hasMissingMeta, "should have missing folder metadata warning; warnings: %v", jobObj.Status.Warnings)
		require.True(t, hasResourceWarning, "should have resource validation warning; warnings: %v", jobObj.Status.Warnings)

		// Mixed warning types → CompletedWithWarnings (not MissingFolderMetadata)
		helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonCompletedWithWarnings)
	})
}

// TestIntegrationProvisioning_FullSync_MissingFolderMetadata_FlagDisabled verifies that when the
// provisioningFolderMetadata feature flag is disabled, a full sync on a repository with a folder
// that has no _folder.json completes successfully without any _folder.json-related warnings.
func TestIntegrationProvisioning_FullSync_MissingFolderMetadata_FlagDisabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const repo = "missing-folder-meta-disabled"
	// No withProvisioningFolderMetadata option → flag is disabled
	helper := common.RunGrafana(t)
	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json": "myfolder/dashboard.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	jobObj := &provisioning.Job{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
	require.NoError(t, err)

	require.Equal(t, provisioning.JobStateSuccess, jobObj.Status.State,
		"job should succeed when flag is disabled (no _folder.json check)")

	for _, w := range jobObj.Status.Warnings {
		require.NotContains(t, w, "missing folder metadata",
			"no warning about missing folder metadata should appear when flag is disabled")
	}

	helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonSuccess)
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

// writeToProvisioningPath writes raw content to a relative path under the provisioning directory.
func writeToProvisioningPath(t *testing.T, helper *common.ProvisioningTestHelper, relativePath string, data []byte) {
	t.Helper()
	fullPath := path.Join(helper.ProvisioningPath, relativePath)
	require.NoError(t, os.MkdirAll(path.Dir(fullPath), 0o750))
	require.NoError(t, os.WriteFile(fullPath, data, 0o600))
}

// requireRepoFolderTitle lists all folders managed by repoName and asserts that
// exactly one with the given sourcePath has the expected title.
func requireRepoFolderTitle(t *testing.T, helper *common.ProvisioningTestHelper, repoName, expectedSourcePath, expectedTitle string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		for _, f := range list.Items {
			mgr, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId")
			if mgr != repoName {
				continue
			}
			srcPath, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/sourcePath")
			if srcPath != expectedSourcePath {
				continue
			}
			title, _, _ := unstructured.NestedString(f.Object, "spec", "title")
			if title == expectedTitle {
				return
			}
		}
		c.Errorf("no folder managed by %q at path %q with title %q found", repoName, expectedSourcePath, expectedTitle)
	}, 30*time.Second, 100*time.Millisecond,
		"expected folder with title %q at path %q for repo %q", expectedTitle, expectedSourcePath, repoName)
}

// TestIntegrationProvisioning_FullSync_FolderMetadataTitle verifies that
// full sync uses spec.title from _folder.json when creating/updating folders.
func TestIntegrationProvisioning_FullSync_FolderMetadataTitle(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("folder uses spec.title from _folder.json", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		const repo = "full-sync-meta-title"

		// Write _folder.json with a custom title different from the directory name.
		writeToProvisioningPath(t, helper, "my-team/_folder.json", folderMetadataJSON("stable-uid-1", "My Team Display Name"))

		helper.CreateRepo(t, common.TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "my-team/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)

		requireRepoFolderTitle(t, helper, repo, "my-team", "My Team Display Name")
	})

	t.Run("folder falls back to directory name when spec.title is empty", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		const repo = "full-sync-meta-title-empty"

		// Write _folder.json with an empty title — should fall back to directory name.
		writeToProvisioningPath(t, helper, "reports/_folder.json", folderMetadataJSON("stable-uid-2", ""))

		helper.CreateRepo(t, common.TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "reports/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)

		requireRepoFolderTitle(t, helper, repo, "reports", "reports")
	})

	t.Run("folder uses directory name when no _folder.json exists", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		const repo = "full-sync-meta-title-absent"

		helper.CreateRepo(t, common.TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "analytics/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)

		requireRepoFolderTitle(t, helper, repo, "analytics", "analytics")
	})

	t.Run("nested folders use respective spec.title from _folder.json", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		const repo = "full-sync-meta-title-nested"

		writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("parent-uid", "Parent Display"))
		writeToProvisioningPath(t, helper, "parent/child/_folder.json", folderMetadataJSON("child-uid", "Child Display"))

		helper.CreateRepo(t, common.TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "parent/child/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)

		requireRepoFolderTitle(t, helper, repo, "parent", "Parent Display")
		requireRepoFolderTitle(t, helper, repo, "parent/child", "Child Display")
	})

	t.Run("directory rename preserves metadata title", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		const repo = "full-sync-meta-title-rename"

		writeToProvisioningPath(t, helper, "old-dir/_folder.json", folderMetadataJSON("stable-uid-rename", "My Team"))

		helper.CreateRepo(t, common.TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "old-dir/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		// First sync creates the folder with "My Team" title.
		helper.SyncAndWait(t, repo, nil)
		requireRepoFolderTitle(t, helper, repo, "old-dir", "My Team")

		// Rename directory: old-dir → new-dir (keep _folder.json with same UID and title).
		oldPath := path.Join(helper.ProvisioningPath, "old-dir")
		newPath := path.Join(helper.ProvisioningPath, "new-dir")
		require.NoError(t, os.Rename(oldPath, newPath))

		// Second sync — title must remain "My Team" (from _folder.json), not "new-dir".
		helper.SyncAndWait(t, repo, nil)
		requireRepoFolderTitle(t, helper, repo, "new-dir", "My Team")
	})
}
