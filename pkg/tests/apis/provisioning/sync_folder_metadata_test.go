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

// moveInProvisioningPath renames (moves) a relative path within the provisioning directory.
func moveInProvisioningPath(t *testing.T, helper *common.ProvisioningTestHelper, from, to string) {
	t.Helper()
	fromPath := path.Join(helper.ProvisioningPath, from)
	toPath := path.Join(helper.ProvisioningPath, to)
	require.NoError(t, os.MkdirAll(path.Dir(toPath), 0o750), "create parent for move destination")
	require.NoError(t, os.Rename(fromPath, toPath), "move %s to %s", from, to)
}

// requireFolderState gets a folder by UID and asserts its title, source path, and parent.
func requireFolderState(t *testing.T, helper *common.ProvisioningTestHelper, folderUID, expectedTitle, expectedSourcePath, expectedParent string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := helper.Folders.Resource.Get(t.Context(), folderUID, metav1.GetOptions{})
		if !assert.NoError(c, err, "failed to get folder %s", folderUID) {
			return
		}

		title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		assert.Equal(c, expectedTitle, title, "folder title")

		annotations := obj.GetAnnotations()
		assert.Equal(c, expectedSourcePath, annotations["grafana.app/sourcePath"], "source path")
		assert.Equal(c, expectedParent, annotations["grafana.app/folder"], "parent folder")
	}, 30*time.Second, 100*time.Millisecond,
		"expected folder %q with title=%q sourcePath=%q parent=%q", folderUID, expectedTitle, expectedSourcePath, expectedParent)
}

// requireRepoFolderTitle lists all folders managed by repoName and asserts that
// exactly one has the given title.
func requireRepoFolderTitle(t *testing.T, helper *common.ProvisioningTestHelper, repoName, expectedTitle string) {
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
			title, _, _ := unstructured.NestedString(f.Object, "spec", "title")
			if title == expectedTitle {
				return
			}
		}
		c.Errorf("no folder managed by %q with title %q found", repoName, expectedTitle)
	}, 30*time.Second, 100*time.Millisecond,
		"expected folder with title %q for repo %q", expectedTitle, repoName)
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

		requireRepoFolderTitle(t, helper, repo, "My Team Display Name")
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

		requireRepoFolderTitle(t, helper, repo, "reports")
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

		requireRepoFolderTitle(t, helper, repo, "analytics")
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

		requireRepoFolderTitle(t, helper, repo, "Parent Display")
		requireRepoFolderTitle(t, helper, repo, "Child Display")
	})
}

// findFolderUIDBySourcePath lists all folders managed by repoName and returns the UID
// of the folder whose grafana.app/sourcePath annotation matches the given sourcePath.
func findFolderUIDBySourcePath(t *testing.T, helper *common.ProvisioningTestHelper, repoName, sourcePath string) string {
	t.Helper()
	var uid string
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		for _, f := range list.Items {
			annotations := f.GetAnnotations()
			if annotations["grafana.app/managerId"] != repoName {
				continue
			}
			if annotations["grafana.app/sourcePath"] == sourcePath {
				uid = f.GetName()
				return
			}
		}
		c.Errorf("no folder managed by %q with sourcePath %q found", repoName, sourcePath)
	}, 30*time.Second, 100*time.Millisecond,
		"expected folder with sourcePath %q for repo %q", sourcePath, repoName)
	return uid
}

// requireDashboardParents lists all dashboards managed by repoName and asserts that
// for each entry in expected (keyed by grafana.app/sourcePath), the grafana.app/folder
// annotation matches the expected parent UID.
func requireDashboardParents(t *testing.T, helper *common.ProvisioningTestHelper, repoName string, expected map[string]string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		found := make(map[string]string) // sourcePath → folder annotation
		for _, d := range list.Items {
			annotations := d.GetAnnotations()
			if annotations["grafana.app/managerId"] != repoName {
				continue
			}
			sp := annotations["grafana.app/sourcePath"]
			if _, ok := expected[sp]; ok {
				found[sp] = annotations["grafana.app/folder"]
			}
		}
		for sp, expectedParent := range expected {
			actualParent, ok := found[sp]
			if !assert.True(c, ok, "dashboard with sourcePath %q not found", sp) {
				continue
			}
			assert.Equal(c, expectedParent, actualParent, "dashboard %q parent folder", sp)
		}
	}, 30*time.Second, 100*time.Millisecond,
		"expected dashboards with correct parents for repo %q", repoName)
}

// TestIntegrationProvisioning_FullSync_FolderMoveWithMetadata verifies that when folders
// are moved on the filesystem, a full sync correctly handles the DELETE+CREATE flow:
// - Folders with _folder.json preserve their stable UID at the new location
// - Folders without _folder.json get new auto-generated UIDs
// - Dashboard parent folder annotations are updated to reflect the new structure
func TestIntegrationProvisioning_FullSync_FolderMoveWithMetadata(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-metadata"

	// Initial filesystem layout:
	//   teamA/_folder.json          (uid="team-a-uid", title="Team A Display")
	//   teamA/dashboard.json        (all-panels.json)
	//   teamB/_folder.json          (uid="team-b-uid", title="Team B Display")
	//   teamB/dashboard.json        (text-options.json)
	//   teamC/dashboard.json        (timeline-demo.json)
	//   teamC/teamD/.keep           (empty nested folder)
	writeToProvisioningPath(t, helper, "teamA/_folder.json", folderMetadataJSON("team-a-uid", "Team A Display"))
	writeToProvisioningPath(t, helper, "teamB/_folder.json", folderMetadataJSON("team-b-uid", "Team B Display"))
	writeToProvisioningPath(t, helper, "teamC/teamD/.keep", []byte{})

	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json":    "teamA/dashboard.json",
			"testdata/text-options.json":  "teamB/dashboard.json",
			"testdata/timeline-demo.json": "teamC/dashboard.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	// --- Verify initial state ---
	// teamA and teamB have stable UIDs from _folder.json
	requireFolderState(t, helper, "team-a-uid", "Team A Display", "teamA", repo)
	requireFolderState(t, helper, "team-b-uid", "Team B Display", "teamB", repo)

	// teamC and teamD have auto-generated UIDs — discover them
	teamCUID := findFolderUIDBySourcePath(t, helper, repo, "teamC")
	teamDUID := findFolderUIDBySourcePath(t, helper, repo, "teamC/teamD")
	require.NotEmpty(t, teamCUID, "teamC should have an auto-generated UID")
	require.NotEmpty(t, teamDUID, "teamD should have an auto-generated UID")

	// Verify teamC is at root level, teamD is inside teamC
	requireFolderState(t, helper, teamCUID, "teamC", "teamC", repo)
	requireFolderState(t, helper, teamDUID, "teamD", "teamC/teamD", teamCUID)

	// Verify dashboard parent folder annotations
	requireDashboardParents(t, helper, repo, map[string]string{
		"teamA/dashboard.json": "team-a-uid",
		"teamB/dashboard.json": "team-b-uid",
		"teamC/dashboard.json": teamCUID,
	})

	// --- Perform filesystem moves ---
	// 1. teamB → teamC/teamB (move teamB inside teamC)
	moveInProvisioningPath(t, helper, "teamB", "teamC/teamB")
	// 2. teamC → teamA/teamC (move teamC inside teamA — carries teamC/teamB along)
	moveInProvisioningPath(t, helper, "teamC", "teamA/teamC")
	// 3. teamA/teamC/teamD → teamA/teamD (move teamD out of teamC, directly under teamA)
	moveInProvisioningPath(t, helper, "teamA/teamC/teamD", "teamA/teamD")

	// Resulting filesystem:
	//   teamA/_folder.json
	//   teamA/dashboard.json
	//   teamA/teamC/dashboard.json
	//   teamA/teamC/teamB/_folder.json
	//   teamA/teamC/teamB/dashboard.json
	//   teamA/teamD/.keep

	helper.SyncAndWait(t, repo, nil)

	// --- Verify final state ---
	// teamA: stable UID preserved, still at root
	requireFolderState(t, helper, "team-a-uid", "Team A Display", "teamA", repo)

	// teamC: auto-UID → deleted and recreated with a new UID, now child of teamA
	newTeamCUID := findFolderUIDBySourcePath(t, helper, repo, "teamA/teamC")
	require.NotEmpty(t, newTeamCUID, "teamC should exist at new path")

	// teamB: stable UID preserved (thanks to _folder.json), parent changed to new teamC
	requireFolderState(t, helper, "team-b-uid", "Team B Display", "teamA/teamC/teamB", newTeamCUID)

	// teamC: verify parent is teamA
	requireFolderState(t, helper, newTeamCUID, "teamC", "teamA/teamC", "team-a-uid")

	// teamD: auto-UID → deleted and recreated with a new UID, now child of teamA
	newTeamDUID := findFolderUIDBySourcePath(t, helper, repo, "teamA/teamD")
	require.NotEmpty(t, newTeamDUID, "teamD should exist at new path")
	requireFolderState(t, helper, newTeamDUID, "teamD", "teamA/teamD", "team-a-uid")

	// Verify dashboard parent folder annotations after moves
	requireDashboardParents(t, helper, repo, map[string]string{
		"teamA/dashboard.json":             "team-a-uid",
		"teamA/teamC/teamB/dashboard.json": "team-b-uid",
		"teamA/teamC/dashboard.json":       newTeamCUID,
	})
}
