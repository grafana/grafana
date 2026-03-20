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

// TestIntegrationProvisioning_IncrementalSync_FolderMetadataTitleUpdate verifies
// that incremental sync propagates title changes in _folder.json to Grafana folders.
func TestIntegrationProvisioning_IncrementalSync_FolderMetadataTitleUpdate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("updates folder title when _folder.json spec.title changes", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const repoName = "incr-meta-title-update"

		_, local := helper.createGitRepo(t, repoName, map[string][]byte{
			"alpha/_folder.json": folderMetadataJSON("alpha-uid", "Alpha"),
			"alpha/dash.json":    dashboardJSON("alpha-dash", "Alpha Dashboard", 1),
		})

		helper.syncAndWait(t, repoName)
		requireRepoFolderTitle(t, helper, ctx, repoName, "Alpha")

		require.NoError(t, local.UpdateFile("alpha/_folder.json", string(folderMetadataJSON("alpha-uid", "Alpha Renamed"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "rename folder title in _folder.json")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.syncAndWaitIncremental(t, repoName)

		requireRepoFolderTitle(t, helper, ctx, repoName, "Alpha Renamed")
	})

	t.Run("updates nested folder title", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const repoName = "incr-meta-title-nested-upd"

		_, local := helper.createGitRepo(t, repoName, map[string][]byte{
			"parent/_folder.json":       folderMetadataJSON("parent-uid-upd", "Parent Title"),
			"parent/child/_folder.json": folderMetadataJSON("child-uid-upd", "Child Title"),
			"parent/child/dash.json":    dashboardJSON("nested-upd-dash", "Nested Dashboard", 1),
		})

		helper.syncAndWait(t, repoName)
		requireRepoFolderTitle(t, helper, ctx, repoName, "Parent Title")
		requireRepoFolderTitle(t, helper, ctx, repoName, "Child Title")

		require.NoError(t, local.UpdateFile("parent/child/_folder.json", string(folderMetadataJSON("child-uid-upd", "Child Title Updated"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "update nested folder title")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.syncAndWaitIncremental(t, repoName)

		requireRepoFolderTitle(t, helper, ctx, repoName, "Parent Title")
		requireRepoFolderTitle(t, helper, ctx, repoName, "Child Title Updated")
	})

	t.Run("updates title alongside dashboard changes", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const repoName = "incr-meta-title-with-dash"

		_, local := helper.createGitRepo(t, repoName, map[string][]byte{
			"team/_folder.json": folderMetadataJSON("team-uid-combo", "Original Team"),
			"team/dash.json":    dashboardJSON("combo-dash", "Original Dashboard", 1),
		})

		helper.syncAndWait(t, repoName)
		requireRepoFolderTitle(t, helper, ctx, repoName, "Original Team")
		common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "combo-dash", "Original Dashboard")

		require.NoError(t, local.UpdateFile("team/_folder.json", string(folderMetadataJSON("team-uid-combo", "Updated Team"))))
		require.NoError(t, local.UpdateFile("team/dash.json", string(dashboardJSON("combo-dash", "Updated Dashboard", 2))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "update folder title and dashboard in same commit")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.syncAndWaitIncremental(t, repoName)

		requireRepoFolderTitle(t, helper, ctx, repoName, "Updated Team")
		common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "combo-dash", "Updated Dashboard")
	})
}

// TestIntegrationProvisioning_IncrementalSync_GracefulFolderRename verifies
// that renaming a folder backed by _folder.json updates the K8s object in place
// (preserving its UID, generation and creationTimestamp) instead of deleting
// and recreating it. Dashboards inside the folder are also verified to be
// updated in place.
func TestIntegrationProvisioning_IncrementalSync_GracefulFolderRename(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("root to root rename", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const repoName = "incr-rename-root-root"
		const folderUID = "rr-folder-uid"

		_, local := helper.createGitRepo(t, repoName, map[string][]byte{
			"old-team/_folder.json":    folderMetadataJSON(folderUID, "My Team"),
			"old-team/dashboard1.json": dashboardJSON("rr-dash-001", "Team Dashboard", 1),
		})

		helper.syncAndWait(t, repoName)
		common.RequireRepoFolders(t, helper.FoldersV1, ctx, repoName, []string{"old-team"})

		folderBefore, err := helper.FoldersV1.Resource.Get(ctx, folderUID, metav1.GetOptions{})
		require.NoError(t, err)
		folderSnap := common.SnapshotObject(t, folderBefore)

		dashBefore, err := helper.DashboardsV1.Resource.Get(ctx, "rr-dash-001", metav1.GetOptions{})
		require.NoError(t, err)
		dashSnap := common.SnapshotObject(t, dashBefore)

		_, err = local.Git("mv", "old-team", "new-team")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "rename old-team to new-team")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.syncAndWaitIncremental(t, repoName)

		folderAfter, err := helper.FoldersV1.Resource.Get(ctx, folderUID, metav1.GetOptions{})
		require.NoError(t, err, "folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "folder", folderSnap, common.SnapshotObject(t, folderAfter))

		sp, _, _ := unstructured.NestedString(folderAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "new-team", sp)
		folderParent, _, _ := unstructured.NestedString(folderAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Empty(t, folderParent, "root-level folder should have no parent")

		common.RequireRepoFolders(t, helper.FoldersV1, ctx, repoName, []string{"new-team"})

		// FIXME: RenameResourceFile does delete+create, so dashboards inside renamed
		// folders are recreated with new UIDs. They should be updated in place instead.
		dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "rr-dash-001", metav1.GetOptions{})
		require.NoError(t, err)
		common.RequireRecreated(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"rr-dash-001": {Title: "Team Dashboard", SourcePath: "new-team/dashboard1.json", Folder: folderUID},
		})
	})

	t.Run("nested to nested rename within same parent", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const repoName = "incr-rename-nested-nested"
		const parentUID = "nn-parent-uid"
		const childUID = "nn-child-uid"

		_, local := helper.createGitRepo(t, repoName, map[string][]byte{
			"parent/_folder.json":              folderMetadataJSON(parentUID, "Parent"),
			"parent/old-child/_folder.json":    folderMetadataJSON(childUID, "Child"),
			"parent/old-child/dashboard1.json": dashboardJSON("nn-dash-001", "Child Dashboard", 1),
		})

		helper.syncAndWait(t, repoName)
		common.RequireRepoFolders(t, helper.FoldersV1, ctx, repoName, []string{"parent", "parent/old-child"})

		childBefore, err := helper.FoldersV1.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err)
		childSnap := common.SnapshotObject(t, childBefore)

		dashBefore, err := helper.DashboardsV1.Resource.Get(ctx, "nn-dash-001", metav1.GetOptions{})
		require.NoError(t, err)
		dashSnap := common.SnapshotObject(t, dashBefore)

		_, err = local.Git("mv", "parent/old-child", "parent/new-child")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "rename child within parent")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.syncAndWaitIncremental(t, repoName)

		childAfter, err := helper.FoldersV1.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err, "child folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "child folder", childSnap, common.SnapshotObject(t, childAfter))

		sp, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "parent/new-child", sp)
		childParent, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, parentUID, childParent, "child folder should still be parented under parent")

		common.RequireRepoFolders(t, helper.FoldersV1, ctx, repoName, []string{"parent", "parent/new-child"})

		// FIXME: RenameResourceFile does delete+create, so dashboards inside renamed
		// folders are recreated with new UIDs. They should be updated in place instead.
		dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "nn-dash-001", metav1.GetOptions{})
		require.NoError(t, err)
		common.RequireRecreated(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"nn-dash-001": {Title: "Child Dashboard", SourcePath: "parent/new-child/dashboard1.json", Folder: childUID},
		})
	})

	t.Run("root to nested rename", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const repoName = "incr-rename-root-nested"
		const parentUID = "rn-parent-uid"
		const movedUID = "rn-moved-uid"

		_, local := helper.createGitRepo(t, repoName, map[string][]byte{
			"parent/_folder.json":       folderMetadataJSON(parentUID, "Parent"),
			"my-folder/_folder.json":    folderMetadataJSON(movedUID, "My Folder"),
			"my-folder/dashboard1.json": dashboardJSON("rn-dash-001", "Moved Dashboard", 1),
		})

		helper.syncAndWait(t, repoName)
		common.RequireRepoFolders(t, helper.FoldersV1, ctx, repoName, []string{"parent", "my-folder"})

		folderBefore, err := helper.FoldersV1.Resource.Get(ctx, movedUID, metav1.GetOptions{})
		require.NoError(t, err)
		folderSnap := common.SnapshotObject(t, folderBefore)

		dashBefore, err := helper.DashboardsV1.Resource.Get(ctx, "rn-dash-001", metav1.GetOptions{})
		require.NoError(t, err)
		dashSnap := common.SnapshotObject(t, dashBefore)

		_, err = local.Git("mv", "my-folder", "parent/my-folder")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move my-folder into parent")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.syncAndWaitIncremental(t, repoName)

		folderAfter, err := helper.FoldersV1.Resource.Get(ctx, movedUID, metav1.GetOptions{})
		require.NoError(t, err, "moved folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "folder", folderSnap, common.SnapshotObject(t, folderAfter))

		sp, _, _ := unstructured.NestedString(folderAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "parent/my-folder", sp)

		parentAnnotation, _, _ := unstructured.NestedString(folderAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, parentUID, parentAnnotation, "moved folder should now be parented under parent")

		common.RequireRepoFolders(t, helper.FoldersV1, ctx, repoName, []string{"parent", "parent/my-folder"})

		// FIXME: RenameResourceFile does delete+create, so dashboards inside renamed
		// folders are recreated with new UIDs. They should be updated in place instead.
		dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "rn-dash-001", metav1.GetOptions{})
		require.NoError(t, err)
		common.RequireRecreated(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"rn-dash-001": {Title: "Moved Dashboard", SourcePath: "parent/my-folder/dashboard1.json", Folder: movedUID},
		})
	})

	t.Run("nested to root rename", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const repoName = "incr-rename-nested-root"
		const parentUID = "nr-parent-uid"
		const movedUID = "nr-moved-uid"

		_, local := helper.createGitRepo(t, repoName, map[string][]byte{
			"parent/_folder.json":              folderMetadataJSON(parentUID, "Parent"),
			"parent/my-folder/_folder.json":    folderMetadataJSON(movedUID, "My Folder"),
			"parent/my-folder/dashboard1.json": dashboardJSON("nr-dash-001", "Moved Dashboard", 1),
		})

		helper.syncAndWait(t, repoName)
		common.RequireRepoFolders(t, helper.FoldersV1, ctx, repoName, []string{"parent", "parent/my-folder"})

		folderBefore, err := helper.FoldersV1.Resource.Get(ctx, movedUID, metav1.GetOptions{})
		require.NoError(t, err)
		folderSnap := common.SnapshotObject(t, folderBefore)

		dashBefore, err := helper.DashboardsV1.Resource.Get(ctx, "nr-dash-001", metav1.GetOptions{})
		require.NoError(t, err)
		dashSnap := common.SnapshotObject(t, dashBefore)

		_, err = local.Git("mv", "parent/my-folder", "my-folder")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move my-folder out to root")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.syncAndWaitIncremental(t, repoName)

		folderAfter, err := helper.FoldersV1.Resource.Get(ctx, movedUID, metav1.GetOptions{})
		require.NoError(t, err, "moved folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "folder", folderSnap, common.SnapshotObject(t, folderAfter))

		sp, _, _ := unstructured.NestedString(folderAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "my-folder", sp)
		folderParent, _, _ := unstructured.NestedString(folderAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Empty(t, folderParent, "folder moved to root should have no parent")

		common.RequireRepoFolders(t, helper.FoldersV1, ctx, repoName, []string{"parent", "my-folder"})

		// FIXME: RenameResourceFile does delete+create, so dashboards inside renamed
		// folders are recreated with new UIDs. They should be updated in place instead.
		dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "nr-dash-001", metav1.GetOptions{})
		require.NoError(t, err)
		common.RequireRecreated(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"nr-dash-001": {Title: "Moved Dashboard", SourcePath: "my-folder/dashboard1.json", Folder: movedUID},
		})
	})

	t.Run("rename folder with both resources and folder children", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const repoName = "incr-rename-mixed"
		const parentUID = "mx-parent-uid"
		const childUID = "mx-child-uid"

		// Seed: parent folder with a dashboard and a child folder that also has a dashboard.
		_, local := helper.createGitRepo(t, repoName, map[string][]byte{
			"old-parent/_folder.json":          folderMetadataJSON(parentUID, "Parent"),
			"old-parent/parent-dash.json":      dashboardJSON("mx-parent-dash", "Parent Dashboard", 1),
			"old-parent/child/_folder.json":    folderMetadataJSON(childUID, "Child"),
			"old-parent/child/child-dash.json": dashboardJSON("mx-child-dash", "Child Dashboard", 1),
		})

		helper.syncAndWait(t, repoName)
		common.RequireRepoFolders(t, helper.FoldersV1, ctx, repoName, []string{"old-parent", "old-parent/child"})

		parentBefore, err := helper.FoldersV1.Resource.Get(ctx, parentUID, metav1.GetOptions{})
		require.NoError(t, err)
		parentSnap := common.SnapshotObject(t, parentBefore)

		childBefore, err := helper.FoldersV1.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err)
		childSnap := common.SnapshotObject(t, childBefore)

		parentDashBefore, err := helper.DashboardsV1.Resource.Get(ctx, "mx-parent-dash", metav1.GetOptions{})
		require.NoError(t, err)
		parentDashSnap := common.SnapshotObject(t, parentDashBefore)

		childDashBefore, err := helper.DashboardsV1.Resource.Get(ctx, "mx-child-dash", metav1.GetOptions{})
		require.NoError(t, err)
		childDashSnap := common.SnapshotObject(t, childDashBefore)

		// Rename the parent folder.
		_, err = local.Git("mv", "old-parent", "new-parent")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "rename parent folder with child and dashboards")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.syncAndWaitIncremental(t, repoName)

		// Verify parent folder updated in place.
		parentAfter, err := helper.FoldersV1.Resource.Get(ctx, parentUID, metav1.GetOptions{})
		require.NoError(t, err, "parent folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "parent folder", parentSnap, common.SnapshotObject(t, parentAfter))

		sp, _, _ := unstructured.NestedString(parentAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "new-parent", sp)
		parentAnnotation, _, _ := unstructured.NestedString(parentAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Empty(t, parentAnnotation, "root-level parent should have no parent annotation")

		// Verify child folder updated in place and still parented under the renamed parent.
		childAfter, err := helper.FoldersV1.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err, "child folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "child folder", childSnap, common.SnapshotObject(t, childAfter))

		childSP, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "new-parent/child", childSP)
		childParent, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, parentUID, childParent, "child should still be parented under renamed parent")

		common.RequireRepoFolders(t, helper.FoldersV1, ctx, repoName, []string{"new-parent", "new-parent/child"})

		// FIXME: RenameResourceFile does delete+create, so dashboards inside renamed
		// folders are recreated with new UIDs. They should be updated in place instead.
		parentDashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "mx-parent-dash", metav1.GetOptions{})
		require.NoError(t, err)
		common.RequireRecreated(t, "parent dashboard", parentDashSnap, common.SnapshotObject(t, parentDashAfter))

		childDashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "mx-child-dash", metav1.GetOptions{})
		require.NoError(t, err)
		common.RequireRecreated(t, "child dashboard", childDashSnap, common.SnapshotObject(t, childDashAfter))

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"mx-parent-dash": {Title: "Parent Dashboard", SourcePath: "new-parent/parent-dash.json", Folder: parentUID},
			"mx-child-dash":  {Title: "Child Dashboard", SourcePath: "new-parent/child/child-dash.json", Folder: childUID},
		})
	})

	t.Run("non-metadata folder rename still works via delete and create", func(t *testing.T) {
		helper := runGrafanaWithGitServer(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const repoName = "incr-graceful-rename-nometa"

		_, local := helper.createGitRepo(t, repoName, map[string][]byte{
			"old-team/dashboard1.json": dashboardJSON("gr-nometa-001", "No Meta Dashboard", 1),
		})

		helper.syncAndWait(t, repoName)
		common.RequireRepoFolders(t, helper.FoldersV1, ctx, repoName, []string{"old-team"})

		_, err := local.Git("mv", "old-team", "new-team")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "rename folder without metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.syncAndWaitIncremental(t, repoName)

		common.RequireRepoFolders(t, helper.FoldersV1, ctx, repoName, []string{"new-team"})

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"gr-nometa-001": {Title: "No Meta Dashboard", SourcePath: "new-team/dashboard1.json"},
		})
	})
}
