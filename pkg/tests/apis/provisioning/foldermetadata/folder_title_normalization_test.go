package foldermetadata

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_MigrateFolderTitleNormalization migrates a nested
// tree of folders whose titles each contain a different path-unsafe pattern and
// verifies the end-to-end result:
//
//   - each folder is exported under a normalized, IsSafe path segment while its
//     original display title is preserved in _folder.json (spec.title),
//   - a title with no usable characters falls back to the folder UID as its path
//     segment (so the segment is always non-empty and deterministic),
//   - a folder path containing a space round-trips through the /files endpoint,
//   - the migrate completes successfully and the resources become managed, which
//     proves the pull half of the migrate consumed the normalized/space paths.
//
// # How a Grafana folder tree maps into the repository
//
// In Grafana a folder has a stable UID (metadata.name) and a free-form display
// title (spec.title); nesting is expressed by each folder pointing at its parent
// UID. Titles may contain any character. When such a tree is exported, the
// repository mirrors the *hierarchy*, but each directory name is a sanitized
// segment derived from the title — the raw title itself lives on inside that
// directory's _folder.json (spec.title), so display names survive untouched.
//
//	Grafana (UID · "title")            Repository layout
//	────────────────────────────      ─────────────────────────────────────
//	folder-alpha · "» A&B"             AB/
//	└─ folder-beta · "My Group"        └─ My Group/              (space kept)
//	   └─ folder-gamma · ".hidden"        └─ hidden/             (leading dot trimmed)
//	      └─ folder-delta · "🚀🎉"           └─ folder-delta/     (no safe chars → UID)
//	         └─ dash "Sample Dashboard"       ├─ _folder.json     (metadata.name+spec.title)
//	                                          └─ sample-dashboard.json
//
// Every folder title is normalized per SanitizeSegment: "» A&B" drops the "»" and
// "&" (leading space trimmed) → "AB"; "My Group" keeps its space; ".hidden" loses
// its leading dot; and "🚀🎉" has no representable characters so the segment falls
// back to the folder UID "folder-delta". A resource file name is the slug of its
// title, so "Sample Dashboard" → sample-dashboard.json.
//
// Before the title-normalization fix a folder titled "» A&B" produced an unsafe
// repository path; the write failed but was recorded as an ignored no-op, so the
// migrate reported "no changes to sync" as a success while exporting nothing.
func TestIntegrationProvisioning_MigrateFolderTitleNormalization(t *testing.T) {
	helper := sharedHelper(t)
	ctx := t.Context()

	// Fixed UIDs keep every assertion deterministic — including the UID-fallback
	// case, where the path segment is the UID itself.
	const (
		alphaUID   = "folder-alpha"
		alphaTitle = "» A&B"
		betaUID    = "folder-beta"
		betaTitle  = "My Group"
		gammaUID   = "folder-gamma"
		gammaTitle = ".hidden"
		deltaUID   = "folder-delta"
		deltaTitle = "🚀🎉"
	)

	createUnmanagedFolder(t, helper, alphaUID, alphaTitle)
	createUnmanagedFolderWithParent(t, helper, betaUID, betaTitle, alphaUID)
	createUnmanagedFolderWithParent(t, helper, gammaUID, gammaTitle, betaUID)
	createUnmanagedFolderWithParent(t, helper, deltaUID, deltaTitle, gammaUID)
	dashName := helper.CreateUnmanagedDashboard(t, ctx, "Sample Dashboard", deltaUID)

	const repo = "folder-title-normalization-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	// Expected normalized path segments. Titles themselves are preserved in
	// _folder.json and asserted separately below.
	const (
		alphaSeg = "AB"       // "» A&B": unicode + '&' dropped, leading space trimmed
		betaSeg  = "My Group" // interior space preserved
		gammaSeg = "hidden"   // leading dot trimmed (not a hidden path)
		deltaSeg = deltaUID   // emoji-only title falls back to the UID
	)
	betaPath := filepath.Join(alphaSeg, betaSeg)
	gammaPath := filepath.Join(betaPath, gammaSeg)
	deltaPath := filepath.Join(gammaPath, deltaSeg)

	helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{
			Message: "Migrate folders with problematic titles",
		},
	})

	common.PrintFileTree(t, helper.ProvisioningPath)

	// 1) _folder.json at each normalized path: the path segment is sanitized but
	// the display title survives untouched.
	readManifest := func(t *testing.T, relPath string) foldersV1.Folder {
		t.Helper()
		data, err := os.ReadFile(filepath.Join(helper.ProvisioningPath, relPath, "_folder.json")) //nolint:gosec // known test output path
		require.NoError(t, err, "_folder.json should exist at %s", relPath)
		var f foldersV1.Folder
		require.NoError(t, json.Unmarshal(data, &f), "_folder.json at %s should be valid JSON", relPath)
		return f
	}
	for _, tc := range []struct {
		relPath   string
		wantUID   string
		wantTitle string
	}{
		{alphaSeg, alphaUID, alphaTitle},
		{betaPath, betaUID, betaTitle},
		{gammaPath, gammaUID, gammaTitle},
		{deltaPath, deltaUID, deltaTitle},
	} {
		m := readManifest(t, tc.relPath)
		assert.Equal(t, tc.wantUID, m.Name, "UID preserved for %s", tc.relPath)
		assert.Equal(t, tc.wantTitle, m.Spec.Title, "display title preserved for %s", tc.relPath)
	}

	// 2) The dashboard lands under the deepest path, which combines a preserved
	// space segment and the UID-fallback segment.
	dashFile := filepath.Join(helper.ProvisioningPath, deltaPath, "sample-dashboard.json")
	_, err := os.Stat(dashFile)
	require.NoError(t, err, "dashboard should be exported at its normalized nested path %s", dashFile)

	// 3) The /files endpoint serves a space-containing path correctly (the path is
	// URL-encoded on the wire and decoded server-side before IsSafe validation).
	// The /files endpoint always uses forward slashes; ToSlash keeps the path
	// correct if filepath.Join produced OS-specific separators (e.g. on Windows).
	files := helper.NewFilesClient(repo)
	require.Equal(t, betaTitle, files.ReadFolderTitle(t, ctx, filepath.ToSlash(betaPath)+"/_folder.json"),
		"reading a _folder.json at a path with a space through the /files endpoint should work")
	require.Equal(t, deltaUID, files.ReadFolderUID(t, ctx, filepath.ToSlash(deltaPath)+"/_folder.json"))

	// 4) The pull half of the migrate consumed the normalized/space paths: the
	// deepest folder and the dashboard end up managed by the repository.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		f, err := helper.Folders.Resource.Get(ctx, deltaUID, metav1.GetOptions{})
		if !assert.NoError(collect, err, "deepest folder should exist") {
			return
		}
		assert.Equal(collect, repo, f.GetAnnotations()[utils.AnnoKeyManagerIdentity],
			"deepest folder should be managed by the repo after migrate")

		d, err := helper.DashboardsV1.Resource.Get(ctx, dashName, metav1.GetOptions{})
		if !assert.NoError(collect, err, "dashboard should exist") {
			return
		}
		assert.Equal(collect, repo, d.GetAnnotations()[utils.AnnoKeyManagerIdentity],
			"dashboard should be managed by the repo after migrate")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "resources should become managed after migrate")

	// 5) Writing through the /files endpoint into a folder path that contains a
	// space works, and a subsequent pull reconciles the new file into Grafana
	// under the space-named folder.
	const writtenUID = "written-sample-dash"
	// Repo/HTTP path uses forward slashes; the on-disk path uses filepath.Join.
	writeRepoPath := filepath.ToSlash(betaPath) + "/written-dashboard.json" // AB/My Group/written-dashboard.json
	resp := files.Post(t, writeRepoPath, common.DashboardJSON(writtenUID, "Written Sample", 1))
	require.Equal(t, http.StatusOK, resp.StatusCode,
		"writing a dashboard under a folder path with a space should succeed: %s", resp.BodyString())

	_, err = os.Stat(filepath.Join(helper.ProvisioningPath, betaPath, "written-dashboard.json"))
	require.NoError(t, err, "written dashboard should exist on disk at the space path %s", writeRepoPath)

	// A pull must read the space path back out of the repo tree and reconcile it.
	helper.SyncAndWait(t, repo, nil)
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		d, err := helper.DashboardsV1.Resource.Get(ctx, writtenUID, metav1.GetOptions{})
		if !assert.NoError(collect, err, "written dashboard should exist after pull") {
			return
		}
		assert.Equal(collect, repo, d.GetAnnotations()[utils.AnnoKeyManagerIdentity],
			"written dashboard should be managed after pull")
		assert.Equal(collect, betaUID, d.GetAnnotations()[utils.AnnoKeyFolder],
			"written dashboard should be parented under the space-named folder")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "written dashboard should sync under the space folder")
}

// TestIntegrationProvisioning_PullFoldersWithSpaces proves the sync/pull
// direction handles repository folder paths that contain spaces in isolation —
// with no export/migrate step first. A repository is seeded with a nested folder
// tree whose directory names contain spaces (each with its own _folder.json) plus
// a dashboard in the deepest folder; a full pull must read those space-containing
// directory names out of the repo tree and reconcile the whole hierarchy into
// Grafana, preserving each folder's title and parent relationship.
//
//	Repository (seeded on disk)          Grafana (after pull)
//	────────────────────────────       ─────────────────────────────────────
//	Team Space/_folder.json             folder "pull-alpha" · "Team Space"
//	└─ Sub Group/_folder.json           └─ folder "pull-beta" · "Sub Group"
//	   └─ pulled-dashboard.json            └─ dashboard "pull-dash"
func TestIntegrationProvisioning_PullFoldersWithSpaces(t *testing.T) {
	helper := sharedHelper(t)
	ctx := t.Context()

	const (
		repo        = "pull-space-folders-repo"
		parentUID   = "pull-alpha"
		parentTitle = "Team Space"
		childUID    = "pull-beta"
		childTitle  = "Sub Group"
		dashUID     = "pull-dash"
		dashTitle   = "Sample Dashboard"
	)

	// SkipSync so the repository exists before we seed it; the pull below is the
	// action under test.
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		Workflows:              []string{"write"},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	// Seed a repository whose directory names contain spaces, each carrying a
	// _folder.json, with a dashboard in the deepest folder.
	parentPath := parentTitle                          // "Team Space"
	childPath := filepath.Join(parentPath, childTitle) // "Team Space/Sub Group"
	helper.WriteToProvisioningPath(t, filepath.Join(parentPath, "_folder.json"), common.FolderBody(t, parentUID, parentTitle))
	helper.WriteToProvisioningPath(t, filepath.Join(childPath, "_folder.json"), common.FolderBody(t, childUID, childTitle))
	helper.WriteToProvisioningPath(t, filepath.Join(childPath, "pulled-dashboard.json"), common.DashboardJSON(dashUID, dashTitle, 1))

	helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		parent, err := helper.Folders.Resource.Get(ctx, parentUID, metav1.GetOptions{})
		if !assert.NoError(collect, err, "parent folder should be created by the pull") {
			return
		}
		assert.Equal(collect, repo, parent.GetAnnotations()[utils.AnnoKeyManagerIdentity],
			"parent folder should be managed by the repo")
		parentGrafanaTitle, _, _ := unstructured.NestedString(parent.Object, "spec", "title")
		assert.Equal(collect, parentTitle, parentGrafanaTitle, "parent title should survive the pull")

		child, err := helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
		if !assert.NoError(collect, err, "nested folder should be created by the pull") {
			return
		}
		assert.Equal(collect, repo, child.GetAnnotations()[utils.AnnoKeyManagerIdentity],
			"nested folder should be managed by the repo")
		assert.Equal(collect, parentUID, child.GetAnnotations()[utils.AnnoKeyFolder],
			"nested folder should be parented under the space-named parent")
		childGrafanaTitle, _, _ := unstructured.NestedString(child.Object, "spec", "title")
		assert.Equal(collect, childTitle, childGrafanaTitle, "nested folder title should survive the pull")

		d, err := helper.DashboardsV1.Resource.Get(ctx, dashUID, metav1.GetOptions{})
		if !assert.NoError(collect, err, "dashboard should be created by the pull") {
			return
		}
		assert.Equal(collect, repo, d.GetAnnotations()[utils.AnnoKeyManagerIdentity],
			"dashboard should be managed by the repo")
		assert.Equal(collect, childUID, d.GetAnnotations()[utils.AnnoKeyFolder],
			"dashboard should be parented under the deepest space folder")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "pull should reconcile the space-named folder tree into Grafana")
}

// TestIntegrationProvisioning_MigrateFolderTitleCollisionFails verifies that when
// two sibling folders have titles that normalize to the same repository path
// (here "» Reports" and "Reports" both → "Reports"), the migrate fails loudly
// instead of silently letting one folder's metadata represent the other. This is
// the integration counterpart to the export-layer collision guard.
func TestIntegrationProvisioning_MigrateFolderTitleCollisionFails(t *testing.T) {
	helper := sharedHelper(t)

	createUnmanagedFolder(t, helper, "collision-a", "» Reports")
	createUnmanagedFolder(t, helper, "collision-b", "Reports")

	const repo = "folder-title-collision-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action:  provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{Message: "Migrate colliding folder titles"},
	})

	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))
	require.Equal(t, provisioning.JobStateError, jobObj.Status.State,
		"migrate should fail when two folder titles normalize to the same path")

	combined := jobObj.Status.Message + " " + strings.Join(jobObj.Status.Errors, " ")
	require.Contains(t, combined, "both export to path",
		"failure should explain the path collision; message=%q errors=%v", jobObj.Status.Message, jobObj.Status.Errors)
}
