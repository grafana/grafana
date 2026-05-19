package foldermetadata

import (
	//nolint:gosec // Test SHA-1 hash (generated for testing purposes only, never used in production)
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
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
)

// sha1Hex computes the SHA-1 hash of data and returns the lowercase hex string.
// This matches the hash algorithm used by the local filesystem repository.
func sha1Hex(data []byte) string {
	h := sha1.Sum(data)
	return hex.EncodeToString(h[:])
}

// TestIntegrationProvisioning_FullSync_MissingFolderMetadata_FlagEnabled verifies that when the
// provisioningFolderMetadata feature flag is enabled, a full sync on a repository that has folders
// without _folder.json produces a warning job state and a MissingFolderMetadata condition reason.
func TestIntegrationProvisioning_FullSync_MissingFolderMetadata_FlagEnabled(t *testing.T) {
	t.Run("single folder", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "missing-folder-meta-single"
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				// Dashboard inside a folder that intentionally has no _folder.json
				"../testdata/all-panels.json": "myfolder/dashboard.json",
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
		helper := sharedHelper(t)
		const repo = "missing-folder-meta-multi"
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				// Two dashboards in separate folders, neither has a _folder.json
				"../testdata/all-panels.json":    "folderA/dashboard1.json",
				"../testdata/timeline-demo.json": "folderB/dashboard2.json",
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
		helper := sharedHelper(t)
		const repo = "folder-meta-with-warnings"
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				// Dashboard in folder without _folder.json → MissingFolderMetadata
				"../testdata/all-panels.json": "myfolder/dashboard.json",
				// Invalid dashboard at root → ResourceInvalid
				"../testdata/dashboard-missing-name.json": "bad-dashboard.json",
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

// requireRepoFolderTitle lists all folders managed by repoName and asserts that
// exactly one with the given sourcePath has the expected title.
func requireRepoFolderTitle(t *testing.T, helper *common.ProvisioningTestHelper, repoName, expectedSourcePath, expectedTitle string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		// Collect what we did see for the repo so a flake's error message
		// shows whether the folder is missing entirely vs. has a wrong title.
		var seen []string
		for _, f := range list.Items {
			mgr, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId")
			if mgr != repoName {
				continue
			}
			srcPath, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/sourcePath")
			title, _, _ := unstructured.NestedString(f.Object, "spec", "title")
			if srcPath == expectedSourcePath && title == expectedTitle {
				return
			}
			seen = append(seen, fmt.Sprintf("{name=%s sourcePath=%q title=%q}", f.GetName(), srcPath, title))
		}
		c.Errorf("no folder managed by %q at path %q with title %q found; folders for repo: [%s]",
			repoName, expectedSourcePath, expectedTitle, strings.Join(seen, ", "))
	}, 30*time.Second, 100*time.Millisecond,
		"expected folder with title %q at path %q for repo %q", expectedTitle, expectedSourcePath, repoName)
}

// TestIntegrationProvisioning_FullSync_FolderMetadataTitle verifies that
// full sync uses spec.title from _folder.json when creating/updating folders.
func TestIntegrationProvisioning_FullSync_FolderMetadataTitle(t *testing.T) {
	t.Run("folder uses spec.title from _folder.json", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-meta-title"

		// Write _folder.json with a custom title different from the directory name.
		writeToProvisioningPath(t, helper, "my-team/_folder.json", folderMetadataJSON("stable-uid-1", "My Team Display Name"))

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "my-team/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)

		requireRepoFolderTitle(t, helper, repo, "my-team", "My Team Display Name")
	})

	t.Run("folder falls back to directory name when spec.title is empty", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-meta-title-empty"

		// Write _folder.json with an empty title — should fall back to directory name.
		writeToProvisioningPath(t, helper, "reports/_folder.json", folderMetadataJSON("stable-uid-2", ""))

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "reports/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)

		requireRepoFolderTitle(t, helper, repo, "reports", "reports")
	})

	t.Run("folder uses directory name when no _folder.json exists", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-meta-title-absent"

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "analytics/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)

		requireRepoFolderTitle(t, helper, repo, "analytics", "analytics")
	})

	t.Run("nested folders use respective spec.title from _folder.json", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-meta-title-nested"

		writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("parent-uid", "Parent Display"))
		writeToProvisioningPath(t, helper, "parent/child/_folder.json", folderMetadataJSON("child-uid", "Child Display"))

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "parent/child/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)

		requireRepoFolderTitle(t, helper, repo, "parent", "Parent Display")
		requireRepoFolderTitle(t, helper, repo, "parent/child", "Child Display")
	})

	t.Run("directory rename preserves metadata title", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-meta-title-rename"

		writeToProvisioningPath(t, helper, "old-dir/_folder.json", folderMetadataJSON("stable-uid-rename", "My Team"))

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "old-dir/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		// First sync creates the folder with "My Team" title.
		helper.SyncAndWait(t, repo, nil)
		requireRepoFolderTitle(t, helper, repo, "old-dir", "My Team")

		// Rename directory: old-dir → new-dir (keep _folder.json with same UID and title).
		oldPath := filepath.Join(helper.ProvisioningPath, "old-dir")
		newPath := filepath.Join(helper.ProvisioningPath, "new-dir")
		require.NoError(t, os.Rename(oldPath, newPath))

		// Second sync — title must remain "My Team" (from _folder.json), not "new-dir".
		helper.SyncAndWait(t, repo, nil)
		requireRepoFolderTitle(t, helper, repo, "new-dir", "My Team")
	})

	t.Run("directory rename without metadata updates title to new directory name", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-no-meta-rename"

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				// Folder has no _folder.json — title defaults to directory name.
				"../testdata/all-panels.json": "old-name/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		// First sync: folder title should equal the directory name "old-name".
		helper.SyncAndWait(t, repo, nil)
		requireRepoFolderTitle(t, helper, repo, "old-name", "old-name")

		// Rename directory: old-name → new-name (no _folder.json is added).
		oldPath := filepath.Join(helper.ProvisioningPath, "old-name")
		newPath := filepath.Join(helper.ProvisioningPath, "new-name")
		require.NoError(t, os.Rename(oldPath, newPath))

		// Second sync — title must update to "new-name" since there is no metadata to override it.
		helper.SyncAndWait(t, repo, nil)
		requireRepoFolderTitle(t, helper, repo, "new-name", "new-name")
	})
}

// requireRepoFolderChecksum lists all folders managed by repoName and asserts that
// one with the given sourcePath has the expected sourceChecksum annotation value.
func requireRepoFolderChecksum(t *testing.T, helper *common.ProvisioningTestHelper, repoName, expectedSourcePath, expectedChecksum string) {
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
			checksum, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/sourceChecksum")
			assert.Equal(c, expectedChecksum, checksum, "sourceChecksum mismatch for folder at path %q", expectedSourcePath)
			return
		}
		c.Errorf("no folder managed by %q at path %q found", repoName, expectedSourcePath)
	}, 30*time.Second, 100*time.Millisecond,
		"expected folder at path %q for repo %q to have sourceChecksum %q", expectedSourcePath, repoName, expectedChecksum)
}

// TestIntegrationProvisioning_FullSync_FolderMetadataChecksum verifies that
// full sync persists the _folder.json hash as sourceChecksum on the Grafana folder.
func TestIntegrationProvisioning_FullSync_FolderMetadataChecksum(t *testing.T) {
	t.Run("folder has sourceChecksum after sync with _folder.json", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-meta-checksum"

		metadataContent := folderMetadataJSON("checksum-uid-1", "Checksum Folder")
		writeToProvisioningPath(t, helper, "my-folder/_folder.json", metadataContent)

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "my-folder/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)

		requireRepoFolderTitle(t, helper, repo, "my-folder", "Checksum Folder")
		requireRepoFolderChecksum(t, helper, repo, "my-folder", sha1Hex(metadataContent))
	})

	t.Run("folder without _folder.json has no sourceChecksum", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-no-meta-checksum"

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "plain-folder/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)

		// Folder should exist but without sourceChecksum
		requireRepoFolderTitle(t, helper, repo, "plain-folder", "plain-folder")
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			list, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
			if !assert.NoError(c, err) {
				return
			}
			for _, f := range list.Items {
				mgr, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId")
				if mgr != repo {
					continue
				}
				srcPath, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/sourcePath")
				if srcPath != "plain-folder" {
					continue
				}
				checksum, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/sourceChecksum")
				assert.Empty(c, checksum, "folder without _folder.json should not have sourceChecksum")
				return
			}
			c.Errorf("folder not found")
		}, 30*time.Second, 100*time.Millisecond)
	})

	t.Run("nested folders both have sourceChecksum", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-meta-checksum-nested"

		parentContent := folderMetadataJSON("parent-ck-uid", "Parent")
		childContent := folderMetadataJSON("child-ck-uid", "Child")
		writeToProvisioningPath(t, helper, "parent/_folder.json", parentContent)
		writeToProvisioningPath(t, helper, "parent/child/_folder.json", childContent)

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "parent/child/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)

		requireRepoFolderChecksum(t, helper, repo, "parent", sha1Hex(parentContent))
		requireRepoFolderChecksum(t, helper, repo, "parent/child", sha1Hex(childContent))
	})
}

// TestIntegrationProvisioning_FullSync_FolderMetadataReconciliation verifies that
// full sync detects _folder.json changes via hash comparison and reconciles folder metadata.
func TestIntegrationProvisioning_FullSync_FolderMetadataReconciliation(t *testing.T) {
	t.Run("title update via _folder.json only", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-meta-title-update"

		// First sync: folder with original title.
		originalContent := folderMetadataJSON("title-update-uid", "Old Title")
		writeToProvisioningPath(t, helper, "my-folder/_folder.json", originalContent)

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "my-folder/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)
		requireRepoFolderTitle(t, helper, repo, "my-folder", "Old Title")
		requireRepoFolderChecksum(t, helper, repo, "my-folder", sha1Hex(originalContent))

		// Modify only _folder.json — change the title, keep the same UID.
		updatedContent := folderMetadataJSON("title-update-uid", "New Title")
		writeToProvisioningPath(t, helper, "my-folder/_folder.json", updatedContent)

		// Second sync: title should be reconciled, checksum updated.
		helper.SyncAndWait(t, repo, nil)
		requireRepoFolderTitle(t, helper, repo, "my-folder", "New Title")
		requireRepoFolderChecksum(t, helper, repo, "my-folder", sha1Hex(updatedContent))
	})

	t.Run("no update when _folder.json unchanged between syncs", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-meta-no-change"

		metadataContent := folderMetadataJSON("no-change-uid", "Stable Title")
		writeToProvisioningPath(t, helper, "my-folder/_folder.json", metadataContent)

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "my-folder/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)
		requireRepoFolderTitle(t, helper, repo, "my-folder", "Stable Title")
		requireRepoFolderChecksum(t, helper, repo, "my-folder", sha1Hex(metadataContent))

		// Second sync — nothing changed. Title and checksum should be identical.
		helper.SyncAndWait(t, repo, nil)
		requireRepoFolderTitle(t, helper, repo, "my-folder", "Stable Title")
		requireRepoFolderChecksum(t, helper, repo, "my-folder", sha1Hex(metadataContent))
	})
}

// TestIntegrationProvisioning_FullSync_FolderMetadataUIDChange verifies that
// full sync handles UID changes in _folder.json by replacing the folder and re-parenting children.
func TestIntegrationProvisioning_FullSync_FolderMetadataUIDChange(t *testing.T) {
	t.Run("UID change replaces folder and re-parents dashboard", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-meta-uid-change"

		// First sync: folder with original UID.
		originalContent := folderMetadataJSON("original-uid", "My Folder")
		writeToProvisioningPath(t, helper, "my-folder/_folder.json", originalContent)

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "my-folder/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)
		requireRepoFolderTitle(t, helper, repo, "my-folder", "My Folder")

		// Change UID in _folder.json, keep title the same.
		updatedContent := folderMetadataJSON("new-uid", "My Folder")
		writeToProvisioningPath(t, helper, "my-folder/_folder.json", updatedContent)

		// Second sync: should replace folder (new UID) and re-parent the dashboard.
		helper.SyncAndWait(t, repo, nil)

		// New folder should exist with correct title and checksum.
		requireRepoFolderTitle(t, helper, repo, "my-folder", "My Folder")
		requireRepoFolderChecksum(t, helper, repo, "my-folder", sha1Hex(updatedContent))

		// Verify the folder UID is the new one by checking the folder name.
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			list, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
			if !assert.NoError(c, err) {
				return
			}
			for _, f := range list.Items {
				mgr, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId")
				if mgr != repo {
					continue
				}
				srcPath, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/sourcePath")
				if srcPath != "my-folder" {
					continue
				}
				assert.Equal(c, "new-uid", f.GetName(), "folder should have new UID")
				return
			}
			c.Errorf("folder not found")
		}, 30*time.Second, 100*time.Millisecond)

		// Verify the dashboard's parent folder annotation points to the new UID.
		requireDashboardParents(t, helper, repo, map[string]string{
			"my-folder/dashboard.json": "new-uid",
		})
	})

	t.Run("UID change deletes old folder and re-parents child folder", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "uid-change-child-folder"

		// First sync: parent with original UID, child folder + dashboard inside.
		writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("parent-old-uid", "Parent"))
		writeToProvisioningPath(t, helper, "parent/child/_folder.json", folderMetadataJSON("child-uid", "Child"))

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "parent/child/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)
		common.RequireFolderState(t, helper.Folders, "parent-old-uid", "Parent", "parent", repo)
		common.RequireFolderState(t, helper.Folders, "child-uid", "Child", "parent/child", "parent-old-uid")
		requireDashboardParents(t, helper, repo, map[string]string{
			"parent/child/dashboard.json": "child-uid",
		})

		// Change parent UID only.
		writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("parent-new-uid", "Parent"))

		helper.SyncAndWait(t, repo, nil)

		// Old folder should be gone.
		assertNoFolderByUID(t, helper, "parent-old-uid")

		// New parent folder should exist with correct state.
		common.RequireFolderState(t, helper.Folders, "parent-new-uid", "Parent", "parent", repo)

		// Child folder should be re-parented to new parent UID.
		common.RequireFolderState(t, helper.Folders, "child-uid", "Child", "parent/child", "parent-new-uid")

		// Dashboard should still be parented to child (unchanged).
		requireDashboardParents(t, helper, repo, map[string]string{
			"parent/child/dashboard.json": "child-uid",
		})
	})

	t.Run("nested UID changes — both parent and child UIDs change", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "uid-change-nested"

		// First sync: parent + child each with original UIDs.
		writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("p-old", "Parent"))
		writeToProvisioningPath(t, helper, "parent/child/_folder.json", folderMetadataJSON("c-old", "Child"))

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "parent/child/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)
		common.RequireFolderState(t, helper.Folders, "p-old", "Parent", "parent", repo)
		common.RequireFolderState(t, helper.Folders, "c-old", "Child", "parent/child", "p-old")

		// Change both UIDs.
		writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("p-new", "Parent"))
		writeToProvisioningPath(t, helper, "parent/child/_folder.json", folderMetadataJSON("c-new", "Child"))

		helper.SyncAndWait(t, repo, nil)

		// Both old UIDs should be gone.
		assertNoFolderByUID(t, helper, "p-old")
		assertNoFolderByUID(t, helper, "c-old")

		// New parent under repo root, new child under new parent.
		common.RequireFolderState(t, helper.Folders, "p-new", "Parent", "parent", repo)
		common.RequireFolderState(t, helper.Folders, "c-new", "Child", "parent/child", "p-new")

		// Dashboard re-parented to new child.
		requireDashboardParents(t, helper, repo, map[string]string{
			"parent/child/dashboard.json": "c-new",
		})
	})

	t.Run("UID change on root-level folder re-parents dashboard", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "uid-change-root-level"

		// First sync: root-level folder with original UID.
		// The folder's parent is the repository folder (Target: "folder").
		writeToProvisioningPath(t, helper, "root-folder/_folder.json", folderMetadataJSON("root-old-uid", "Root Folder"))

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "root-folder/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		helper.SyncAndWait(t, repo, nil)
		common.RequireFolderState(t, helper.Folders, "root-old-uid", "Root Folder", "root-folder", repo)
		requireDashboardParents(t, helper, repo, map[string]string{
			"root-folder/dashboard.json": "root-old-uid",
		})

		// Change UID in _folder.json.
		writeToProvisioningPath(t, helper, "root-folder/_folder.json", folderMetadataJSON("root-new-uid", "Root Folder"))

		helper.SyncAndWait(t, repo, nil)

		// Old folder should be gone.
		assertNoFolderByUID(t, helper, "root-old-uid")

		// New folder should exist with repo as parent (folder-target repo).
		common.RequireFolderState(t, helper.Folders, "root-new-uid", "Root Folder", "root-folder", repo)

		// Dashboard re-parented to new UID.
		requireDashboardParents(t, helper, repo, map[string]string{
			"root-folder/dashboard.json": "root-new-uid",
		})
	})
}

// TestIntegrationProvisioning_FullSync_FolderMetadataDeletedReverts verifies that
// deleting a _folder.json between syncs causes the folder to revert to hash-based UID
// and directory-name title, and that child resources are re-parented accordingly.
func TestIntegrationProvisioning_FullSync_FolderMetadataDeletedReverts(t *testing.T) {
	t.Run("folder reverts to hash-based UID and directory-name title", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-meta-deleted-revert"

		// First sync: folder with _folder.json (stable UID + custom title).
		writeToProvisioningPath(t, helper, "my-folder/_folder.json", folderMetadataJSON("stable-uid", "Custom Title"))
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "my-folder/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})
		helper.SyncAndWait(t, repo, nil)
		common.RequireFolderState(t, helper.Folders, "stable-uid", "Custom Title", "my-folder", repo)

		// Delete _folder.json (keep the directory and dashboard).
		require.NoError(t, os.Remove(filepath.Join(helper.ProvisioningPath, "my-folder/_folder.json")))

		// Second sync — folder should revert.
		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
		require.NotEmpty(t, jobObj.Status.Warnings)

		found := false
		for _, w := range jobObj.Status.Warnings {
			if strings.Contains(w, "missing folder metadata") && strings.Contains(w, "my-folder") {
				found = true
				break
			}
		}
		require.True(t, found, "expected missing folder metadata warning for my-folder; warnings: %v", jobObj.Status.Warnings)
		helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonMissingFolderMetadata)

		// Old stable-UID folder should be gone.
		assertNoFolderByUID(t, helper, "stable-uid")

		// New folder should exist with directory-name title and empty checksum.
		newUID := findFolderUIDBySourcePath(t, helper, repo, "my-folder")
		require.NotEqual(t, "stable-uid", newUID, "folder should have a new hash-based UID")
		requireRepoFolderTitle(t, helper, repo, "my-folder", "my-folder") // title = directory name
		requireRepoFolderChecksum(t, helper, repo, "my-folder", "")       // checksum cleared

		// Dashboard re-parented to new UID.
		requireDashboardParents(t, helper, repo, map[string]string{
			"my-folder/dashboard.json": newUID,
		})
	})

	t.Run("nested: parent _folder.json deleted, child retains metadata", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-meta-deleted-nested"

		writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("parent-uid", "Parent"))
		writeToProvisioningPath(t, helper, "parent/child/_folder.json", folderMetadataJSON("child-uid", "Child"))
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "parent/child/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})
		helper.SyncAndWait(t, repo, nil)
		common.RequireFolderState(t, helper.Folders, "parent-uid", "Parent", "parent", repo)
		common.RequireFolderState(t, helper.Folders, "child-uid", "Child", "parent/child", "parent-uid")

		// Delete ONLY parent's _folder.json.
		require.NoError(t, os.Remove(filepath.Join(helper.ProvisioningPath, "parent/_folder.json")))

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
		require.NotEmpty(t, jobObj.Status.Warnings)

		hasParentWarning := false
		hasChildWarning := false
		for _, w := range jobObj.Status.Warnings {
			if strings.Contains(w, "missing folder metadata") && strings.Contains(w, "parent") {
				hasParentWarning = true
			}
			if strings.Contains(w, "missing folder metadata") && strings.Contains(w, "parent/child") {
				hasChildWarning = true
			}
		}
		require.True(t, hasParentWarning, "expected missing folder metadata warning for parent; warnings: %v", jobObj.Status.Warnings)
		require.False(t, hasChildWarning, "did not expect missing folder metadata warning for parent/child; warnings: %v", jobObj.Status.Warnings)
		helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonMissingFolderMetadata)

		// Old parent-uid should be gone.
		assertNoFolderByUID(t, helper, "parent-uid")

		// New hash-based parent with directory-name title.
		newParentUID := findFolderUIDBySourcePath(t, helper, repo, "parent")
		require.NotEqual(t, "parent-uid", newParentUID)

		// Child should still have its stable UID but re-parented to new parent.
		common.RequireFolderState(t, helper.Folders, "child-uid", "Child", "parent/child", newParentUID)

		// Dashboard still parented to child-uid.
		requireDashboardParents(t, helper, repo, map[string]string{
			"parent/child/dashboard.json": "child-uid",
		})
	})

	t.Run("nested: parent _folder.json deleted while child UID changes", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "full-sync-meta-deleted-child-uid-change"

		writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("parent-uid", "Parent"))
		writeToProvisioningPath(t, helper, "parent/child/_folder.json", folderMetadataJSON("child-old-uid", "Child"))
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "parent/child/dashboard.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})
		helper.SyncAndWait(t, repo, nil)
		common.RequireFolderState(t, helper.Folders, "parent-uid", "Parent", "parent", repo)
		common.RequireFolderState(t, helper.Folders, "child-old-uid", "Child", "parent/child", "parent-uid")

		require.NoError(t, os.Remove(filepath.Join(helper.ProvisioningPath, "parent/_folder.json")))
		writeToProvisioningPath(t, helper, "parent/child/_folder.json", folderMetadataJSON("child-new-uid", "Child"))

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
		require.NotEmpty(t, jobObj.Status.Warnings)

		hasParentWarning := false
		hasChildWarning := false
		for _, w := range jobObj.Status.Warnings {
			if strings.Contains(w, "missing folder metadata") && strings.Contains(w, "parent") {
				hasParentWarning = true
			}
			if strings.Contains(w, "missing folder metadata") && strings.Contains(w, "parent/child") {
				hasChildWarning = true
			}
		}
		require.True(t, hasParentWarning, "expected missing folder metadata warning for parent; warnings: %v", jobObj.Status.Warnings)
		require.False(t, hasChildWarning, "did not expect missing folder metadata warning for parent/child; warnings: %v", jobObj.Status.Warnings)
		helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonMissingFolderMetadata)

		assertNoFolderByUID(t, helper, "parent-uid")
		assertNoFolderByUID(t, helper, "child-old-uid")

		newParentUID := findFolderUIDBySourcePath(t, helper, repo, "parent")
		require.NotEqual(t, "parent-uid", newParentUID)

		common.RequireFolderState(t, helper.Folders, "child-new-uid", "Child", "parent/child", newParentUID)
		requireDashboardParents(t, helper, repo, map[string]string{
			"parent/child/dashboard.json": "child-new-uid",
		})
	})
}
