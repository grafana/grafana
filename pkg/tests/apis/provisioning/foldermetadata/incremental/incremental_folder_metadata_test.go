package incremental

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
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
		helper := sharedGitHelper(t)

		const repoName = "incr-missing-meta-add"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"dashboard.json": common.DashboardJSON("root-dash", "Root Dashboard", 1),
		})

		// Full sync the root dashboard.
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		// Add a dashboard inside a folder that has no _folder.json.
		require.NoError(t, local.CreateFile("myfolder/dashboard2.json", string(common.DashboardJSON("folder-dash", "Folder Dashboard", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add dashboard in folder without metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		// Trigger incremental sync.
		job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
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
		common.RequireJobWarningContains(t, jobObj, "missing folder metadata")
	})

	t.Run("noop incremental sync still detects missing metadata", func(t *testing.T) {
		helper := sharedGitHelper(t)

		const repoName = "incr-missing-meta-noop"

		// Seed with a folder that has no _folder.json.
		helper.CreateGitRepo(t, repoName, map[string][]byte{
			"myfolder/dashboard.json": common.DashboardJSON("noop-dash", "Noop Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())

		// Trigger incremental sync with no new commits — same ref.
		job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
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

// folderMetadataJSON generates a valid _folder.json payload with a stable UID and title.
func folderMetadataJSON(uid, title string) []byte {
	folder := map[string]any{
		"apiVersion": "folder.grafana.app/v1",
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

// TestIntegrationProvisioning_IncrementalSync_FolderMetadataTitle verifies that
// incremental sync uses spec.title from _folder.json when creating folders.
func TestIntegrationProvisioning_IncrementalSync_FolderMetadataTitle(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("folder uses spec.title from _folder.json", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-title"

		// Seed with a dashboard at root.
		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"dashboard.json": common.DashboardJSON("root-dash", "Root Dashboard", 1),
		})
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		// Push a folder with _folder.json that has a custom title different from the directory name.
		require.NoError(t, local.CreateFile("my-team/_folder.json", string(folderMetadataJSON("stable-uid-1", "My Team Display Name"))))
		require.NoError(t, local.CreateFile("my-team/dash.json", string(common.DashboardJSON("team-dash", "Team Dashboard", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add folder with custom metadata title")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		// Incremental sync.
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		// Verify the Grafana folder was created with the metadata title, not the directory name.
		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "My Team Display Name")
	})

	t.Run("folder falls back to directory name when spec.title is empty", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-title-empty"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"dashboard.json": common.DashboardJSON("root-dash-2", "Root Dashboard", 1),
		})
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		// Push a folder with _folder.json that has an empty title — should fall back to dir name.
		require.NoError(t, local.CreateFile("reports/_folder.json", string(folderMetadataJSON("stable-uid-2", ""))))
		require.NoError(t, local.CreateFile("reports/dash.json", string(common.DashboardJSON("reports-dash", "Reports Dashboard", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add folder with empty metadata title")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		// Should use directory name "reports" as the title.
		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "reports")
	})

	t.Run("folder uses directory name when no _folder.json exists", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-title-absent"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"dashboard.json": common.DashboardJSON("root-dash-3", "Root Dashboard", 1),
		})
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		// Push a folder without _folder.json.
		require.NoError(t, local.CreateFile("analytics/dash.json", string(common.DashboardJSON("analytics-dash", "Analytics Dashboard", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add folder without metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Warning())

		// Should use directory name "analytics" as the title.
		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "analytics")
	})

	t.Run("nested folders use respective spec.title from _folder.json", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-title-nested"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"dashboard.json": common.DashboardJSON("root-dash-4", "Root Dashboard", 1),
		})
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		// Push nested folders, each with their own _folder.json and custom titles.
		require.NoError(t, local.CreateFile("parent/_folder.json", string(folderMetadataJSON("parent-uid", "Parent Display"))))
		require.NoError(t, local.CreateFile("parent/child/_folder.json", string(folderMetadataJSON("child-uid", "Child Display"))))
		require.NoError(t, local.CreateFile("parent/child/dash.json", string(common.DashboardJSON("nested-dash", "Nested Dashboard", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add nested folders with custom metadata titles")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		// Both folders should use their metadata titles.
		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "Parent Display")
		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "Child Display")
	})
}

func TestIntegrationProvisioning_IncrementalSync_FolderMetadataCreation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("adding _folder.json clears prior missing metadata warnings", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-create-clears-warning"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"myfolder/dash.json": common.DashboardJSON("warning-dash", "Warning Dashboard", 1),
		})

		// Initial sync warns because myfolder has no _folder.json metadata.
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())

		hashUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "myfolder")
		require.NotEqual(t, "stable-uid", hashUID, "folder should start with a hash-based UID")
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "myfolder/dash.json", hashUID)

		require.NoError(t, local.CreateFile("myfolder/_folder.json", string(folderMetadataJSON("stable-uid", "My Folder"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add folder metadata to clear warning")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Equal(t, provisioning.JobStateSuccess, jobObj.Status.State)
		require.Empty(t, jobObj.Status.Errors)
		for _, w := range jobObj.Status.Warnings {
			require.False(t, strings.Contains(w, "missing folder metadata"),
				"expected missing-metadata warning to be cleared, got: %v", jobObj.Status.Warnings)
		}

		common.RequireRepoFolderUID(t, helper.Folders, ctx, repoName, "stable-uid")
		common.RequireRepoFolderCount(t, helper, ctx, repoName, 1)
		common.RequireRepoDashboardCount(t, helper, ctx, repoName, 1)
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "myfolder/dash.json", "stable-uid")
	})

	t.Run("new _folder.json creates a brand-new empty folder", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-create-empty-folder"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"dashboard.json": common.DashboardJSON("root-dash", "Root Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		require.NoError(t, local.CreateFile("empty-team/_folder.json", string(folderMetadataJSON("empty-team-uid", "Empty Team"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add empty folder metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		common.RequireFolderState(t, helper.Folders, "empty-team-uid", "Empty Team", "empty-team", "")
		common.RequireRepoFolderCount(t, helper, ctx, repoName, 1)
		common.RequireRepoDashboardCount(t, helper, ctx, repoName, 1)
	})

	t.Run("new _folder.json transitions existing folder to stable uid", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-create-existing"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"myfolder/dash.json": common.DashboardJSON("my-dash", "My Dashboard", 1),
		})

		// Initial sync warns because myfolder has no _folder.json metadata.
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())

		oldUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "myfolder")
		require.NotEqual(t, "stable-uid", oldUID, "folder should start with a hash-based UID")
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "myfolder/dash.json", oldUID)

		require.NoError(t, local.CreateFile("myfolder/_folder.json", string(folderMetadataJSON("stable-uid", "My Folder"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add folder metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		common.RequireRepoFolderUID(t, helper.Folders, ctx, repoName, "stable-uid")
		common.RequireRepoFolderCount(t, helper, ctx, repoName, 1)
		common.RequireRepoDashboardCount(t, helper, ctx, repoName, 1)
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "myfolder/dash.json", "stable-uid")
	})

	t.Run("new _folder.json transitions existing folder to stable uid and re-parents children", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-create-existing"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"myfolder/dash.json":       common.DashboardJSON("my-dash", "My Dashboard", 1),
			"myfolder/child/dash.json": common.DashboardJSON("child-dash", "Child Dashboard", 1),
		})

		// Initial sync warns because myfolder and myfolder/child have no _folder.json metadata.
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())

		oldUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "myfolder")
		require.NotEqual(t, "stable-uid", oldUID, "folder should start with a hash-based UID")
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "myfolder/dash.json", oldUID)

		childUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "child")
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "myfolder/child/dash.json", childUID)

		require.NoError(t, local.CreateFile("myfolder/_folder.json", string(folderMetadataJSON("stable-uid", "My Folder"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add folder metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Warning())

		common.RequireRepoFolderUID(t, helper.Folders, ctx, repoName, "stable-uid")
		childUID = common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "child")
		common.RequireFolderState(t, helper.Folders, childUID, "child", "myfolder/child", "stable-uid")

		common.RequireRepoFolderCount(t, helper, ctx, repoName, 2)
		common.RequireRepoDashboardCount(t, helper, ctx, repoName, 2)
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "myfolder/dash.json", "stable-uid")
	})

	t.Run("new _folder.json with direct child rename does not replay the old child path", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-create-child-rename"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"myfolder/dash.json": common.DashboardJSON("my-dash", "My Dashboard", 1),
		})

		// Initial sync warns because myfolder has no _folder.json metadata.
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())

		oldUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "myfolder")
		require.NotEqual(t, "stable-uid", oldUID, "folder should start with a hash-based UID")
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "myfolder/dash.json", oldUID)

		require.NoError(t, local.CreateFile("myfolder/_folder.json", string(folderMetadataJSON("stable-uid", "My Folder"))))
		_, err := local.Git("mv", "myfolder/dash.json", "myfolder/dash-renamed.json")
		require.NoError(t, err)
		_, err = local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add folder metadata and rename child dashboard")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		common.RequireRepoFolderUID(t, helper.Folders, ctx, repoName, "stable-uid")
		common.RequireRepoFolderCount(t, helper, ctx, repoName, 1)
		common.RequireRepoDashboardCount(t, helper, ctx, repoName, 1)
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "myfolder/dash-renamed.json", "stable-uid")
	})

	t.Run("new nested _folder.json files transition both parent and child to stable uids", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-create-nested"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"parent/child/dash.json": common.DashboardJSON("nested-create-dash", "Nested Dashboard", 1),
		})

		// Initial sync warns because parent and parent/child have no _folder.json metadata.
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())

		oldParentUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "parent")
		oldChildUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "child")
		require.NotEqual(t, "p-new", oldParentUID, "parent should start with a hash-based UID")
		require.NotEqual(t, "c-new", oldChildUID, "child should start with a hash-based UID")
		common.RequireFolderState(t, helper.Folders, oldParentUID, "parent", "parent", "")
		common.RequireFolderState(t, helper.Folders, oldChildUID, "child", "parent/child", oldParentUID)
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "parent/child/dash.json", oldChildUID)

		require.NoError(t, local.CreateFile("parent/_folder.json", string(folderMetadataJSON("p-new", "Parent"))))
		require.NoError(t, local.CreateFile("parent/child/_folder.json", string(folderMetadataJSON("c-new", "Child"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add nested folder metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		_, err = helper.Folders.Resource.Get(ctx, oldParentUID, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "old parent folder should be deleted")

		_, err = helper.Folders.Resource.Get(ctx, oldChildUID, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "old child folder should be deleted")

		common.RequireFolderState(t, helper.Folders, "p-new", "Parent", "parent", "")
		common.RequireFolderState(t, helper.Folders, "c-new", "Child", "parent/child", "p-new")
		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"parent", "parent/child"})
		common.RequireRepoFolderCount(t, helper, ctx, repoName, 2)
		common.RequireRepoDashboardCount(t, helper, ctx, repoName, 1)
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "parent/child/dash.json", "c-new")
	})
}

// TestIntegrationProvisioning_IncrementalSync_FolderMetadataTitleUpdate verifies
// that incremental sync propagates title changes in _folder.json to Grafana folders.
func TestIntegrationProvisioning_IncrementalSync_FolderMetadataTitleUpdate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("updates folder title when _folder.json spec.title changes", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-title-update"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"alpha/_folder.json": folderMetadataJSON("alpha-uid", "Alpha"),
			"alpha/dash.json":    common.DashboardJSON("alpha-dash", "Alpha Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "Alpha")

		require.NoError(t, local.UpdateFile("alpha/_folder.json", string(folderMetadataJSON("alpha-uid", "Alpha Renamed"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "rename folder title in _folder.json")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "Alpha Renamed")
	})

	t.Run("updates nested folder title", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-title-nested-upd"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"parent/_folder.json":       folderMetadataJSON("parent-uid-upd", "Parent Title"),
			"parent/child/_folder.json": folderMetadataJSON("child-uid-upd", "Child Title"),
			"parent/child/dash.json":    common.DashboardJSON("nested-upd-dash", "Nested Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "Parent Title")
		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "Child Title")

		require.NoError(t, local.UpdateFile("parent/child/_folder.json", string(folderMetadataJSON("child-uid-upd", "Child Title Updated"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "update nested folder title")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "Parent Title")
		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "Child Title Updated")
	})

	t.Run("updates title alongside dashboard changes", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-title-with-dash"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"team/_folder.json": folderMetadataJSON("team-uid-combo", "Original Team"),
			"team/dash.json":    common.DashboardJSON("combo-dash", "Original Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "Original Team")
		common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "combo-dash", "Original Dashboard")

		require.NoError(t, local.UpdateFile("team/_folder.json", string(folderMetadataJSON("team-uid-combo", "Updated Team"))))
		require.NoError(t, local.UpdateFile("team/dash.json", string(common.DashboardJSON("combo-dash", "Updated Dashboard", 2))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "update folder title and dashboard in same commit")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "Updated Team")
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
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-rename-root-root"
		const folderUID = "rr-folder-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"old-team/_folder.json":    folderMetadataJSON(folderUID, "My Team"),
			"old-team/dashboard1.json": common.DashboardJSON("rr-dash-001", "Team Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"old-team"})

		folderBefore, err := helper.Folders.Resource.Get(ctx, folderUID, metav1.GetOptions{})
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

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		folderAfter, err := helper.Folders.Resource.Get(ctx, folderUID, metav1.GetOptions{})
		require.NoError(t, err, "folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "folder", folderSnap, common.SnapshotObject(t, folderAfter))

		sp, _, _ := unstructured.NestedString(folderAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "new-team", sp)
		folderParent, _, _ := unstructured.NestedString(folderAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Empty(t, folderParent, "root-level folder should have no parent")

		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"new-team"})

		dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "rr-dash-001", metav1.GetOptions{})
		require.NoError(t, err)
		common.RequireUpdatedInPlace(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"rr-dash-001": {Title: "Team Dashboard", SourcePath: "new-team/dashboard1.json", Folder: folderUID},
		})
	})

	t.Run("nested to nested rename within same parent", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-rename-nested-nested"
		const parentUID = "nn-parent-uid"
		const childUID = "nn-child-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"parent/_folder.json":              folderMetadataJSON(parentUID, "Parent"),
			"parent/old-child/_folder.json":    folderMetadataJSON(childUID, "Child"),
			"parent/old-child/dashboard1.json": common.DashboardJSON("nn-dash-001", "Child Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"parent", "parent/old-child"})

		childBefore, err := helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
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

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		childAfter, err := helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err, "child folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "child folder", childSnap, common.SnapshotObject(t, childAfter))

		sp, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "parent/new-child", sp)
		childParent, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, parentUID, childParent, "child folder should still be parented under parent")

		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"parent", "parent/new-child"})

		dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "nn-dash-001", metav1.GetOptions{})
		require.NoError(t, err)
		common.RequireUpdatedInPlace(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"nn-dash-001": {Title: "Child Dashboard", SourcePath: "parent/new-child/dashboard1.json", Folder: childUID},
		})
	})

	t.Run("root to nested rename", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-rename-root-nested"
		const parentUID = "rn-parent-uid"
		const movedUID = "rn-moved-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"parent/_folder.json":       folderMetadataJSON(parentUID, "Parent"),
			"my-folder/_folder.json":    folderMetadataJSON(movedUID, "My Folder"),
			"my-folder/dashboard1.json": common.DashboardJSON("rn-dash-001", "Moved Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"parent", "my-folder"})

		folderBefore, err := helper.Folders.Resource.Get(ctx, movedUID, metav1.GetOptions{})
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

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		folderAfter, err := helper.Folders.Resource.Get(ctx, movedUID, metav1.GetOptions{})
		require.NoError(t, err, "moved folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "folder", folderSnap, common.SnapshotObject(t, folderAfter))

		sp, _, _ := unstructured.NestedString(folderAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "parent/my-folder", sp)

		parentAnnotation, _, _ := unstructured.NestedString(folderAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, parentUID, parentAnnotation, "moved folder should now be parented under parent")

		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"parent", "parent/my-folder"})

		dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "rn-dash-001", metav1.GetOptions{})
		require.NoError(t, err)
		common.RequireUpdatedInPlace(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"rn-dash-001": {Title: "Moved Dashboard", SourcePath: "parent/my-folder/dashboard1.json", Folder: movedUID},
		})
	})

	t.Run("nested to root rename", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-rename-nested-root"
		const parentUID = "nr-parent-uid"
		const movedUID = "nr-moved-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"parent/_folder.json":              folderMetadataJSON(parentUID, "Parent"),
			"parent/my-folder/_folder.json":    folderMetadataJSON(movedUID, "My Folder"),
			"parent/my-folder/dashboard1.json": common.DashboardJSON("nr-dash-001", "Moved Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"parent", "parent/my-folder"})

		folderBefore, err := helper.Folders.Resource.Get(ctx, movedUID, metav1.GetOptions{})
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

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		folderAfter, err := helper.Folders.Resource.Get(ctx, movedUID, metav1.GetOptions{})
		require.NoError(t, err, "moved folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "folder", folderSnap, common.SnapshotObject(t, folderAfter))

		sp, _, _ := unstructured.NestedString(folderAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "my-folder", sp)
		folderParent, _, _ := unstructured.NestedString(folderAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Empty(t, folderParent, "folder moved to root should have no parent")

		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"parent", "my-folder"})

		dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "nr-dash-001", metav1.GetOptions{})
		require.NoError(t, err)
		common.RequireUpdatedInPlace(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"nr-dash-001": {Title: "Moved Dashboard", SourcePath: "my-folder/dashboard1.json", Folder: movedUID},
		})
	})

	t.Run("rename folder with both resources and folder children", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-rename-mixed"
		const parentUID = "mx-parent-uid"
		const childUID = "mx-child-uid"

		// Seed: parent folder with a dashboard and a child folder that also has a dashboard.
		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"old-parent/_folder.json":          folderMetadataJSON(parentUID, "Parent"),
			"old-parent/parent-dash.json":      common.DashboardJSON("mx-parent-dash", "Parent Dashboard", 1),
			"old-parent/child/_folder.json":    folderMetadataJSON(childUID, "Child"),
			"old-parent/child/child-dash.json": common.DashboardJSON("mx-child-dash", "Child Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"old-parent", "old-parent/child"})

		parentBefore, err := helper.Folders.Resource.Get(ctx, parentUID, metav1.GetOptions{})
		require.NoError(t, err)
		parentSnap := common.SnapshotObject(t, parentBefore)

		childBefore, err := helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
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

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		// Verify parent folder updated in place.
		parentAfter, err := helper.Folders.Resource.Get(ctx, parentUID, metav1.GetOptions{})
		require.NoError(t, err, "parent folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "parent folder", parentSnap, common.SnapshotObject(t, parentAfter))

		sp, _, _ := unstructured.NestedString(parentAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "new-parent", sp)
		parentAnnotation, _, _ := unstructured.NestedString(parentAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Empty(t, parentAnnotation, "root-level parent should have no parent annotation")

		// Verify child folder updated in place and still parented under the renamed parent.
		childAfter, err := helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err, "child folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "child folder", childSnap, common.SnapshotObject(t, childAfter))

		childSP, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "new-parent/child", childSP)
		childParent, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, parentUID, childParent, "child should still be parented under renamed parent")

		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"new-parent", "new-parent/child"})

		parentDashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "mx-parent-dash", metav1.GetOptions{})
		require.NoError(t, err)
		common.RequireUpdatedInPlace(t, "parent dashboard", parentDashSnap, common.SnapshotObject(t, parentDashAfter))

		childDashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "mx-child-dash", metav1.GetOptions{})
		require.NoError(t, err)
		common.RequireUpdatedInPlace(t, "child dashboard", childDashSnap, common.SnapshotObject(t, childDashAfter))

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"mx-parent-dash": {Title: "Parent Dashboard", SourcePath: "new-parent/parent-dash.json", Folder: parentUID},
			"mx-child-dash":  {Title: "Child Dashboard", SourcePath: "new-parent/child/child-dash.json", Folder: childUID},
		})
	})

	t.Run("non-metadata folder rename still works via delete and create", func(t *testing.T) {
		t.Skip("Disabled due to flaky context deadline exceeded errors during resource insertion")
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-graceful-rename-nometa"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"old-team/dashboard1.json": common.DashboardJSON("gr-nometa-001", "No Meta Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())
		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"old-team"})

		_, err := local.Git("mv", "old-team", "new-team")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "rename folder without metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Warning())

		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"new-team"})

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"gr-nometa-001": {Title: "No Meta Dashboard", SourcePath: "new-team/dashboard1.json"},
		})
	})
}

// TestIntegrationProvisioning_IncrementalSync_FolderUIDChange verifies that
// incremental sync handles metadata.name (UID) changes in _folder.json by
// creating a new folder with the new UID, re-parenting all children, and
// deleting the old folder.
func TestIntegrationProvisioning_IncrementalSync_FolderUIDChange(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("simple UID change re-parents dashboard", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-uid-change-simple"
		const oldUID = "old-folder-uid"
		const newUID = "new-folder-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"alpha/_folder.json": folderMetadataJSON(oldUID, "Alpha"),
			"alpha/dash.json":    common.DashboardJSON("uid-dash-001", "Alpha Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "Alpha")

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"uid-dash-001": {Title: "Alpha Dashboard", SourcePath: "alpha/dash.json", Folder: oldUID},
		})

		require.NoError(t, local.UpdateFile("alpha/_folder.json", string(folderMetadataJSON(newUID, "Alpha"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "change folder UID")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})

		folderAfter, err := helper.Folders.Resource.Get(ctx, newUID, metav1.GetOptions{})
		require.NoError(t, err, "folder with new UID should exist")
		title, _, _ := unstructured.NestedString(folderAfter.Object, "spec", "title")
		require.Equal(t, "Alpha", title)

		_, err = helper.Folders.Resource.Get(ctx, oldUID, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "old folder UID should be deleted after UID change")

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"uid-dash-001": {Title: "Alpha Dashboard", SourcePath: "alpha/dash.json", Folder: newUID},
		})
	})

	t.Run("UID change with nested child folder", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-uid-change-nested"
		const parentOldUID = "parent-old-uid"
		const parentNewUID = "parent-new-uid"
		const childUID = "child-stable-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"parent/_folder.json":           folderMetadataJSON(parentOldUID, "Parent"),
			"parent/child/_folder.json":     folderMetadataJSON(childUID, "Child"),
			"parent/child/nested-dash.json": common.DashboardJSON("uid-nested-001", "Nested Dashboard", 1),
			"parent/parent-dash.json":       common.DashboardJSON("uid-parent-001", "Parent Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "Parent")
		common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "Child")

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"uid-parent-001": {Title: "Parent Dashboard", SourcePath: "parent/parent-dash.json", Folder: parentOldUID},
			"uid-nested-001": {Title: "Nested Dashboard", SourcePath: "parent/child/nested-dash.json", Folder: childUID},
		})

		require.NoError(t, local.UpdateFile("parent/_folder.json", string(folderMetadataJSON(parentNewUID, "Parent"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "change parent folder UID")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})

		_, err = helper.Folders.Resource.Get(ctx, parentNewUID, metav1.GetOptions{})
		require.NoError(t, err, "parent folder with new UID should exist")

		_, err = helper.Folders.Resource.Get(ctx, parentOldUID, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "old parent folder UID should be deleted after UID change")

		childAfter, err := helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err, "child folder should still exist")
		childParent, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, parentNewUID, childParent, "child should be re-parented to new parent UID")

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"uid-parent-001": {Title: "Parent Dashboard", SourcePath: "parent/parent-dash.json", Folder: parentNewUID},
			"uid-nested-001": {Title: "Nested Dashboard", SourcePath: "parent/child/nested-dash.json", Folder: childUID},
		})
	})

	t.Run("UID change alongside dashboard update in same commit", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-uid-change-combo"
		const oldUID = "combo-old-uid"
		const newUID = "combo-new-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"team/_folder.json": folderMetadataJSON(oldUID, "Team"),
			"team/dash.json":    common.DashboardJSON("uid-combo-001", "Original Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		require.NoError(t, local.UpdateFile("team/_folder.json", string(folderMetadataJSON(newUID, "Team Rebranded"))))
		require.NoError(t, local.UpdateFile("team/dash.json", string(common.DashboardJSON("uid-combo-001", "Updated Dashboard", 2))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "change UID and update dashboard")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})

		folderAfter, err := helper.Folders.Resource.Get(ctx, newUID, metav1.GetOptions{})
		require.NoError(t, err)
		title, _, _ := unstructured.NestedString(folderAfter.Object, "spec", "title")
		require.Equal(t, "Team Rebranded", title)

		_, err = helper.Folders.Resource.Get(ctx, oldUID, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "old folder UID should be deleted after UID change")

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"uid-combo-001": {Title: "Updated Dashboard", SourcePath: "team/dash.json", Folder: newUID},
		})
	})

	t.Run("chained UID changes never accumulate orphans", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-uid-chained"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"team/_folder.json": folderMetadataJSON("uid-v1", "Team"),
			"team/dash.json":    common.DashboardJSON("chain-dash", "Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolderCount(t, helper, ctx, repoName, 1)

		// v1 -> v2
		require.NoError(t, local.UpdateFile("team/_folder.json", string(folderMetadataJSON("uid-v2", "Team v2"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "uid v1 to v2")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		_, err = helper.Folders.Resource.Get(ctx, "uid-v2", metav1.GetOptions{})
		require.NoError(t, err, "v2 folder should exist")
		_, err = helper.Folders.Resource.Get(ctx, "uid-v1", metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "v1 folder should be deleted")
		common.RequireRepoFolderCount(t, helper, ctx, repoName, 1)

		// v2 -> v3
		require.NoError(t, local.UpdateFile("team/_folder.json", string(folderMetadataJSON("uid-v3", "Team v3"))))
		_, err = local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "uid v2 to v3")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		_, err = helper.Folders.Resource.Get(ctx, "uid-v3", metav1.GetOptions{})
		require.NoError(t, err, "v3 folder should exist")
		_, err = helper.Folders.Resource.Get(ctx, "uid-v2", metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "v2 folder should be deleted")
		_, err = helper.Folders.Resource.Get(ctx, "uid-v1", metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "v1 folder should still be deleted")
		common.RequireRepoFolderCount(t, helper, ctx, repoName, 1)

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"chain-dash": {Title: "Dashboard", SourcePath: "team/dash.json", Folder: "uid-v3"},
		})
	})

	t.Run("full sync after incremental UID changes cleans up any remaining orphans", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-uid-full-cleanup"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"team/_folder.json": folderMetadataJSON("cleanup-v1", "Team"),
			"team/dash.json":    common.DashboardJSON("cleanup-dash", "Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolderCount(t, helper, ctx, repoName, 1)

		// Change UID via incremental sync
		require.NoError(t, local.UpdateFile("team/_folder.json", string(folderMetadataJSON("cleanup-v2", "Team v2"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "uid change for cleanup test")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())
		common.RequireRepoFolderCount(t, helper, ctx, repoName, 1)

		// A subsequent full sync should be idempotent — still exactly 1 folder
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolderCount(t, helper, ctx, repoName, 1)

		_, err = helper.Folders.Resource.Get(ctx, "cleanup-v2", metav1.GetOptions{})
		require.NoError(t, err, "current folder should still exist")
		_, err = helper.Folders.Resource.Get(ctx, "cleanup-v1", metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "old folder should not reappear")

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"cleanup-dash": {Title: "Dashboard", SourcePath: "team/dash.json", Folder: "cleanup-v2"},
		})
	})
}

// TestIntegrationProvisioning_IncrementalSync_FolderMetadataDeletion verifies that
// deleting a _folder.json during incremental sync transitions the folder from a
// stable UID back to a hash-derived UID, re-parents children, and deletes the old folder.
func TestIntegrationProvisioning_IncrementalSync_FolderMetadataDeletion(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("simple metadata deletion re-parents dashboard", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-delete-simple"
		const stableUID = "stable-folder-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"alpha/_folder.json": folderMetadataJSON(stableUID, "Alpha"),
			"alpha/dash.json":    common.DashboardJSON("meta-del-001", "Alpha Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		// Verify folder exists with stable UID
		_, err := helper.Folders.Resource.Get(ctx, stableUID, metav1.GetOptions{})
		require.NoError(t, err, "folder with stable UID should exist after full sync")

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"meta-del-001": {Title: "Alpha Dashboard", SourcePath: "alpha/dash.json", Folder: stableUID},
		})

		// Delete _folder.json only, keeping the directory and dashboard
		_, err = local.Git("rm", "alpha/_folder.json")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "delete folder metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})

		// Old stable UID folder should be deleted
		_, err = helper.Folders.Resource.Get(ctx, stableUID, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "old stable UID folder should be deleted after metadata deletion")

		// New folder should exist with hash-based UID and directory name as title
		newFolderUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "alpha")
		require.NotEqual(t, stableUID, newFolderUID, "new folder should have a different UID")

		// Dashboard should be re-parented to the new folder
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"meta-del-001": {Title: "Alpha Dashboard", SourcePath: "alpha/dash.json", Folder: newFolderUID},
		})
	})

	t.Run("metadata deletion with nested child folder", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-delete-nested"
		const parentStableUID = "parent-stable-uid"
		const childStableUID = "child-stable-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"parent/_folder.json":          folderMetadataJSON(parentStableUID, "Parent"),
			"parent/child/_folder.json":    folderMetadataJSON(childStableUID, "Child"),
			"parent/parent-dash.json":      common.DashboardJSON("nested-parent-001", "Parent Dashboard", 1),
			"parent/child/child-dash.json": common.DashboardJSON("nested-child-001", "Child Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"nested-parent-001": {Title: "Parent Dashboard", SourcePath: "parent/parent-dash.json", Folder: parentStableUID},
			"nested-child-001":  {Title: "Child Dashboard", SourcePath: "parent/child/child-dash.json", Folder: childStableUID},
		})

		// Delete only the parent's _folder.json
		_, err := local.Git("rm", "parent/_folder.json")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "delete parent folder metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})

		// Old parent folder should be gone
		_, err = helper.Folders.Resource.Get(ctx, parentStableUID, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "old parent folder should be deleted")

		// New parent folder should exist with hash-based UID
		newParentUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "parent")
		require.NotEqual(t, parentStableUID, newParentUID)

		// Child folder should still exist with its stable UID, re-parented under new parent
		childAfter, err := helper.Folders.Resource.Get(ctx, childStableUID, metav1.GetOptions{})
		require.NoError(t, err, "child folder should still exist")
		childParent, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, newParentUID, childParent, "child should be re-parented to new parent UID")

		// Parent dashboard re-parented; child dashboard unchanged
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"nested-parent-001": {Title: "Parent Dashboard", SourcePath: "parent/parent-dash.json", Folder: newParentUID},
			"nested-child-001":  {Title: "Child Dashboard", SourcePath: "parent/child/child-dash.json", Folder: childStableUID},
		})
	})

	t.Run("metadata deletion re-parents all direct children", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-delete-children"
		const stableUID = "children-stable-uid"
		const childFolderUID = "child-folder-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"team/_folder.json":         folderMetadataJSON(stableUID, "Team"),
			"team/dash-a.json":          common.DashboardJSON("child-dash-a", "Dashboard A", 1),
			"team/dash-b.json":          common.DashboardJSON("child-dash-b", "Dashboard B", 1),
			"team/dash-c.json":          common.DashboardJSON("child-dash-c", "Dashboard C", 1),
			"team/sub/_folder.json":     folderMetadataJSON(childFolderUID, "Sub"),
			"team/sub/nested-dash.json": common.DashboardJSON("child-nested", "Nested Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		_, err := helper.Folders.Resource.Get(ctx, stableUID, metav1.GetOptions{})
		require.NoError(t, err, "folder with stable UID should exist")

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"child-dash-a": {Title: "Dashboard A", SourcePath: "team/dash-a.json", Folder: stableUID},
			"child-dash-b": {Title: "Dashboard B", SourcePath: "team/dash-b.json", Folder: stableUID},
			"child-dash-c": {Title: "Dashboard C", SourcePath: "team/dash-c.json", Folder: stableUID},
			"child-nested": {Title: "Nested Dashboard", SourcePath: "team/sub/nested-dash.json", Folder: childFolderUID},
		})

		childBefore, err := helper.Folders.Resource.Get(ctx, childFolderUID, metav1.GetOptions{})
		require.NoError(t, err)
		childParentBefore, _, _ := unstructured.NestedString(childBefore.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, stableUID, childParentBefore, "child folder should initially be parented under stable UID")

		// Delete only the parent _folder.json
		_, err = local.Git("rm", "team/_folder.json")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "delete parent folder metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})

		// Old stable UID folder should be deleted
		_, err = helper.Folders.Resource.Get(ctx, stableUID, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "old stable UID folder should be deleted")

		// New folder should exist with hash-based UID
		newFolderUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "team")
		require.NotEqual(t, stableUID, newFolderUID)

		// All three dashboards should be re-parented to the new folder
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"child-dash-a": {Title: "Dashboard A", SourcePath: "team/dash-a.json", Folder: newFolderUID},
			"child-dash-b": {Title: "Dashboard B", SourcePath: "team/dash-b.json", Folder: newFolderUID},
			"child-dash-c": {Title: "Dashboard C", SourcePath: "team/dash-c.json", Folder: newFolderUID},
			"child-nested": {Title: "Nested Dashboard", SourcePath: "team/sub/nested-dash.json", Folder: childFolderUID},
		})

		// Child folder should be re-parented to the new parent UID
		childAfter, err := helper.Folders.Resource.Get(ctx, childFolderUID, metav1.GetOptions{})
		require.NoError(t, err, "child folder should still exist")
		childParentAfter, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, newFolderUID, childParentAfter, "child folder should be re-parented to new hash-based UID")
	})

	t.Run("metadata deletion alongside dashboard update in same commit", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-delete-combo"
		const stableUID = "combo-stable-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"team/_folder.json": folderMetadataJSON(stableUID, "Team"),
			"team/dash.json":    common.DashboardJSON("combo-del-001", "Original Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		// Delete metadata and update dashboard in the same commit
		_, err := local.Git("rm", "team/_folder.json")
		require.NoError(t, err)
		require.NoError(t, local.UpdateFile("team/dash.json", string(common.DashboardJSON("combo-del-001", "Updated Dashboard", 2))))
		_, err = local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "delete metadata and update dashboard")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})

		// Old folder should be gone
		_, err = helper.Folders.Resource.Get(ctx, stableUID, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "old stable UID folder should be deleted")

		// New folder with hash-based UID
		newFolderUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "team")
		require.NotEqual(t, stableUID, newFolderUID)

		// Dashboard should be updated and re-parented
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"combo-del-001": {Title: "Updated Dashboard", SourcePath: "team/dash.json", Folder: newFolderUID},
		})
	})
}

// TestIntegrationProvisioning_IncrementalSync_RenamedFolderMetadataOrphanCleanup
// verifies that renaming a _folder.json file (file-only rename, no directory
// rename event) correctly cleans up the old folder resource and creates the new
// folder at the destination path.
func TestIntegrationProvisioning_IncrementalSync_RenamedFolderMetadataOrphanCleanup(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("metadata-only folder rename cleans up old folder", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-rename-orphan"
		const folderUID = "rename-orphan-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"old-team/_folder.json": folderMetadataJSON(folderUID, "Old Team"),
			"old-team/dash.json":    common.DashboardJSON("rename-orphan-dash", "Team Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireFolderState(t, helper.Folders, folderUID, "Old Team", "old-team", "")
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"rename-orphan-dash": {Title: "Team Dashboard", SourcePath: "old-team/dash.json", Folder: folderUID},
		})

		// Move the _folder.json to a new directory while also moving the
		// dashboard. This produces file-level renames in the git diff.
		require.NoError(t, local.CreateDirPath("new-team"))
		_, err := local.Git("mv", "old-team/_folder.json", "new-team/_folder.json")
		require.NoError(t, err)
		_, err = local.Git("mv", "old-team/dash.json", "new-team/dash.json")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move folder contents to new-team")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		// The folder should now be at new-team with the same UID (identity preserved).
		common.RequireFolderState(t, helper.Folders, folderUID, "Old Team", "new-team", "")

		// Only one folder should exist for this repo — old-team should be gone.
		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"new-team"})

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"rename-orphan-dash": {Title: "Team Dashboard", SourcePath: "new-team/dash.json", Folder: folderUID},
		})
	})

	t.Run("metadata moved to folder with dashboard but no metadata", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-rename-to-existing"
		const folderUID = "src-uid-001"

		// Seed: source folder with metadata + dashboard, destination folder
		// with only a dashboard (no _folder.json).
		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"src/_folder.json":  folderMetadataJSON(folderUID, "Source Folder"),
			"src/dash-src.json": common.DashboardJSON("dash-src", "Source Dashboard", 1),
			"dst/dash-dst.json": common.DashboardJSON("dash-dst", "Dest Dashboard", 1),
		})

		// dst/ has no _folder.json, so the initial sync produces a
		// missing-metadata warning.
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())
		common.RequireFolderState(t, helper.Folders, folderUID, "Source Folder", "src", "")
		// dst/ gets a hash-derived UID since it has no metadata.
		dstAutoUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "dst")
		require.NotEqual(t, folderUID, dstAutoUID)

		// Move _folder.json from src/ to dst/. The dashboard stays put.
		_, err := local.Git("mv", "src/_folder.json", "dst/_folder.json")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move metadata to dst")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Warning())

		// dst/ should now carry the metadata UID and title.
		common.RequireFolderState(t, helper.Folders, folderUID, "Source Folder", "dst", "")

		// src/ should still exist (it has a dashboard) but with a
		// hash-derived UID since its metadata is gone.
		srcAutoUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "src")
		require.NotEqual(t, folderUID, srcAutoUID)

		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"src", "dst"})

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"dash-src": {Title: "Source Dashboard", SourcePath: "src/dash-src.json", Folder: srcAutoUID},
			"dash-dst": {Title: "Dest Dashboard", SourcePath: "dst/dash-dst.json", Folder: folderUID},
		})
	})

	t.Run("metadata moved to folder with dashboard and pre-existing metadata", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-rename-over"
		const srcUID = "override-src-uid"
		const dstUID = "override-dst-uid"

		// Seed: both folders have _folder.json with distinct UIDs + dashboards.
		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"src/_folder.json": folderMetadataJSON(srcUID, "Source"),
			"src/dash-s.json":  common.DashboardJSON("dash-s", "Src Dash", 1),
			"dst/_folder.json": folderMetadataJSON(dstUID, "Destination"),
			"dst/dash-d.json":  common.DashboardJSON("dash-d", "Dst Dash", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireFolderState(t, helper.Folders, srcUID, "Source", "src", "")
		common.RequireFolderState(t, helper.Folders, dstUID, "Destination", "dst", "")

		// Overwrite dst/_folder.json with src's metadata. Git sees this as
		// a delete of src/_folder.json + update of dst/_folder.json.
		_, err := local.Git("rm", "src/_folder.json")
		require.NoError(t, err)
		require.NoError(t, local.UpdateFile("dst/_folder.json", string(folderMetadataJSON(srcUID, "Source"))))
		_, err = local.Git("add", "dst/_folder.json")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "replace dst metadata with src metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		// The incremental sync completes with a warning because src/
		// loses its _folder.json (triggering a missing-metadata warning).
		// The src UID is NOT scheduled for deletion because it is being
		// actively written to dst/_folder.json.
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Warning())

		// dst/ should now carry the source UID.
		common.RequireFolderState(t, helper.Folders, srcUID, "Source", "dst", "")

		// src/ still has a dashboard, so it should exist with a hash UID.
		srcAutoUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "src")
		require.NotEqual(t, srcUID, srcAutoUID)

		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"src", "dst"})

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"dash-s": {Title: "Src Dash", SourcePath: "src/dash-s.json", Folder: srcAutoUID},
			"dash-d": {Title: "Dst Dash", SourcePath: "dst/dash-d.json", Folder: srcUID},
		})
	})

	t.Run("metadata-only empty folder rename cleans up old folder", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-meta-rename-empty"
		const folderUID = "empty-rename-uid"

		// Seed: metadata-only folder (no dashboards inside).
		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"old-empty/_folder.json": folderMetadataJSON(folderUID, "Empty Folder"),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireFolderState(t, helper.Folders, folderUID, "Empty Folder", "old-empty", "")

		// Move the _folder.json to a new path — this is a pure file rename.
		require.NoError(t, local.CreateDirPath("new-empty"))
		_, err := local.Git("mv", "old-empty/_folder.json", "new-empty/_folder.json")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "rename empty metadata folder")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		// The folder should now be at new-empty with the same UID.
		common.RequireFolderState(t, helper.Folders, folderUID, "Empty Folder", "new-empty", "")

		// Only one folder should exist for this repo.
		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"new-empty"})
		common.RequireRepoFolderCount(t, helper, ctx, repoName, 1)
	})
}

// TestIntegrationProvisioning_IncrementalSync_FileRenameIntoRelocatedFolder
// verifies that file renames into a folder whose _folder.json was also renamed
// in the same commit (without a directory-level rename entry) succeed.
func TestIntegrationProvisioning_IncrementalSync_FileRenameIntoRelocatedFolder(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("dashboard renamed into folder whose metadata was also renamed", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-file-rename-into-relocated"
		const folderUID = "relocated-folder-uid"

		// Seed: a folder with _folder.json (stable UID), two dashboards,
		// and a second folder with its own dashboard.
		// The extra dashboard in src/ prevents git from detecting a
		// directory rename when we partially move files out.
		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"src/_folder.json": folderMetadataJSON(folderUID, "Source Folder"),
			"src/move.json":    common.DashboardJSON("dash-move", "Moving Dashboard", 1),
			"src/stay.json":    common.DashboardJSON("dash-stay", "Staying Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireFolderState(t, helper.Folders, folderUID, "Source Folder", "src", "")
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"dash-move": {Title: "Moving Dashboard", SourcePath: "src/move.json", Folder: folderUID},
			"dash-stay": {Title: "Staying Dashboard", SourcePath: "src/stay.json", Folder: folderUID},
		})

		// Move _folder.json and one dashboard to a new directory, but
		// leave stay.json behind so git produces file-level renames
		// instead of a directory rename.
		require.NoError(t, local.CreateDirPath("dst"))
		_, err := local.Git("mv", "src/_folder.json", "dst/_folder.json")
		require.NoError(t, err)
		_, err = local.Git("mv", "src/move.json", "dst/move.json")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "partial move: metadata + dashboard to dst")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		// The incremental sync should succeed (with a warning for the
		// now-missing _folder.json in src/). The file rename of move.json
		// into dst/ must not fail with an ID conflict error.
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Warning())

		// dst/ should carry the stable UID.
		common.RequireFolderState(t, helper.Folders, folderUID, "Source Folder", "dst", "")

		// src/ should still exist with a hash-derived UID (has stay.json).
		srcAutoUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "src")
		require.NotEqual(t, folderUID, srcAutoUID, "src/ should have a hash-derived UID after losing _folder.json")

		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"src", "dst"})

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"dash-move": {Title: "Moving Dashboard", SourcePath: "dst/move.json", Folder: folderUID},
			"dash-stay": {Title: "Staying Dashboard", SourcePath: "src/stay.json", Folder: srcAutoUID},
		})
	})

	t.Run("dashboard from unrelated folder renamed into relocated metadata folder", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-cross-folder-rename-reloc"
		const srcUID = "cross-src-uid"

		// Seed: one folder with _folder.json + a dashboard, and a second
		// folder with a dashboard that will move into the first folder's
		// new location.
		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"teamA/_folder.json": folderMetadataJSON(srcUID, "Team A"),
			"teamA/own.json":     common.DashboardJSON("dash-own", "Own Dashboard", 1),
			"teamB/migrate.json": common.DashboardJSON("dash-migrate", "Migrate Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())
		common.RequireFolderState(t, helper.Folders, srcUID, "Team A", "teamA", "")
		teamBUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "teamB")
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"dash-own":     {Title: "Own Dashboard", SourcePath: "teamA/own.json", Folder: srcUID},
			"dash-migrate": {Title: "Migrate Dashboard", SourcePath: "teamB/migrate.json", Folder: teamBUID},
		})

		// Move teamA's _folder.json to teamC/ and move the dashboard
		// from teamB/ into teamC/ in the same commit. teamA/ keeps its
		// dashboard (preventing directory rename detection), and teamB/
		// becomes empty.
		require.NoError(t, local.CreateDirPath("teamC"))
		_, err := local.Git("mv", "teamA/_folder.json", "teamC/_folder.json")
		require.NoError(t, err)
		_, err = local.Git("mv", "teamB/migrate.json", "teamC/migrate.json")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move metadata to teamC and migrate dashboard")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		// The dashboard rename into teamC/ must not fail with
		// an ID conflict error for srcUID (registered at teamA/ in the tree).
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Warning())

		// teamC/ should carry the stable UID from the moved _folder.json.
		common.RequireFolderState(t, helper.Folders, srcUID, "Team A", "teamC", "")

		// teamA/ should still exist with a hash-derived UID.
		teamAAutoUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "teamA")
		require.NotEqual(t, srcUID, teamAAutoUID)

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"dash-own":     {Title: "Own Dashboard", SourcePath: "teamA/own.json", Folder: teamAAutoUID},
			"dash-migrate": {Title: "Migrate Dashboard", SourcePath: "teamC/migrate.json", Folder: srcUID},
		})
	})

	t.Run("dashboard renamed into nested path under relocated metadata folder", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-nested-path-rename-reloc"
		const srcUID = "nested-reloc-src-uid"

		// Seed: teamA with _folder.json (stable UID) and a staying
		// dashboard, plus teamB/nested/ with a dashboard that will
		// migrate into teamC/nested/ alongside teamA's metadata.
		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"teamA/_folder.json":        folderMetadataJSON(srcUID, "Team A"),
			"teamA/own.json":            common.DashboardJSON("dash-own", "Own Dashboard", 1),
			"teamB/nested/migrate.json": common.DashboardJSON("dash-migrate", "Migrate Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())
		common.RequireFolderState(t, helper.Folders, srcUID, "Team A", "teamA", "")

		// Move teamA's _folder.json to teamC/ and move the nested
		// dashboard from teamB/nested/ into teamC/nested/ in the same
		// commit. teamA/ keeps own.json so git produces file-level
		// renames instead of a directory rename.
		require.NoError(t, local.CreateDirPath("teamC/nested"))
		_, err := local.Git("mv", "teamA/_folder.json", "teamC/_folder.json")
		require.NoError(t, err)
		_, err = local.Git("mv", "teamB/nested/migrate.json", "teamC/nested/migrate.json")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move metadata to teamC and migrate nested dashboard")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		// The file rename into teamC/nested/ triggers EnsureFolderPathExist
		// which walks all ancestors including teamC/. The relocation
		// allowlist for srcUID is registered at teamC/ but the immediate
		// directory lookup in applyIncrementalChanges only checks
		// teamC/nested/. Without propagating the ancestor relocation,
		// the ID conflict check rejects the valid move.
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Warning())

		// teamC/ should carry the stable UID.
		common.RequireFolderState(t, helper.Folders, srcUID, "Team A", "teamC", "")

		// teamA/ still has own.json, so it should exist with a
		// hash-derived UID.
		teamAAutoUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "teamA")
		require.NotEqual(t, srcUID, teamAAutoUID)

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"dash-own":     {Title: "Own Dashboard", SourcePath: "teamA/own.json", Folder: teamAAutoUID},
			"dash-migrate": {Title: "Migrate Dashboard", SourcePath: "teamC/nested/migrate.json"},
		})
	})
}

// TestIntegrationProvisioning_IncrementalSync_FolderUIDConflict verifies that
// changing a folder's _folder.json to use a UID that already belongs to another
// folder at a different path is rejected with a warning, not silently allowed.
func TestIntegrationProvisioning_IncrementalSync_FolderUIDConflict(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("updating metadata to steal another folder UID produces a conflict warning", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-uid-conflict"
		const ownerUID = "owner-folder-uid"
		const thiefUID = "thief-folder-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"owner/_folder.json": folderMetadataJSON(ownerUID, "Owner Folder"),
			"owner/dash.json":    common.DashboardJSON("owner-dash", "Owner Dashboard", 1),
			"thief/_folder.json": folderMetadataJSON(thiefUID, "Thief Folder"),
			"thief/dash.json":    common.DashboardJSON("thief-dash", "Thief Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireFolderState(t, helper.Folders, ownerUID, "Owner Folder", "owner", "")
		common.RequireFolderState(t, helper.Folders, thiefUID, "Thief Folder", "thief", "")

		// Change thief's _folder.json to claim owner's UID.
		require.NoError(t, local.CreateFile("thief/_folder.json", string(folderMetadataJSON(ownerUID, "Thief Stealing UID"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "thief steals owner folder UID")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		// Incremental sync should complete with a warning — the UID conflict
		// must not be silently bypassed.
		job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"incremental sync should finish with warning when a folder UID conflict is detected")

		foundConflict := false
		for _, w := range jobObj.Status.Warnings {
			if strings.Contains(w, "already used by folder") {
				foundConflict = true
				break
			}
		}
		require.True(t, foundConflict,
			"expected a warning about folder UID conflict, got warnings: %v", jobObj.Status.Warnings)

		// The owner folder must be untouched — still at its original path with its UID.
		common.RequireFolderState(t, helper.Folders, ownerUID, "Owner Folder", "owner", "")

		// The thief folder's UID conflict was rejected, so it should still
		// exist under its original UID.
		common.RequireRepoFolderUID(t, helper.Folders, ctx, repoName, thiefUID)
	})

	t.Run("real relocation succeeds while simultaneous UID theft is rejected", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-uid-conflict-dual"
		const movingUID = "moving-folder-uid"
		const thiefUID = "thief-dual-uid"

		// Seed: src/ has a folder with movingUID, thief/ has its own UID,
		// and src/ has a dashboard to keep it visible after the move.
		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"src/_folder.json":   folderMetadataJSON(movingUID, "Moving Folder"),
			"src/stay.json":      common.DashboardJSON("dash-stay", "Staying Dashboard", 1),
			"thief/_folder.json": folderMetadataJSON(thiefUID, "Thief Folder"),
			"thief/dash.json":    common.DashboardJSON("thief-dash", "Thief Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireFolderState(t, helper.Folders, movingUID, "Moving Folder", "src", "")
		common.RequireFolderState(t, helper.Folders, thiefUID, "Thief Folder", "thief", "")

		// In one commit: move src/_folder.json to dst/ (real relocation),
		// AND update thief/_folder.json to claim the same UID (theft).
		require.NoError(t, local.CreateDirPath("dst"))
		_, err := local.Git("mv", "src/_folder.json", "dst/_folder.json")
		require.NoError(t, err)
		require.NoError(t, local.CreateFile("thief/_folder.json", string(folderMetadataJSON(movingUID, "Thief Stealing UID"))))
		_, err = local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move folder and steal UID in same commit")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		// Incremental sync: the real move should succeed, the theft should
		// produce a UID conflict warning.
		job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"incremental sync should warn due to the UID theft, even though the real move succeeded")

		foundConflict := false
		for _, w := range jobObj.Status.Warnings {
			if strings.Contains(w, "already used by folder") {
				foundConflict = true
				break
			}
		}
		require.True(t, foundConflict,
			"expected a UID conflict warning for the thief, got warnings: %v", jobObj.Status.Warnings)

		// The real move should have succeeded — movingUID is now at dst/.
		common.RequireFolderState(t, helper.Folders, movingUID, "Moving Folder", "dst", "")

		// src/ should still exist (has stay.json) with a hash-derived UID.
		srcAutoUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "src")
		require.NotEqual(t, movingUID, srcAutoUID, "src/ should have a hash-derived UID after losing _folder.json")

		// The thief's UID conflict was rejected, so it should retain its original UID.
		common.RequireRepoFolderUID(t, helper.Folders, ctx, repoName, thiefUID)
	})
}

// TestIntegrationProvisioning_IncrementalSync_NestedFolderRenameWithStableUIDs
// verifies that renaming a directory tree where both parent and child folders
// have stable UIDs (via _folder.json) succeeds even when the child directory
// rename is processed before the parent directory rename.
func TestIntegrationProvisioning_IncrementalSync_NestedFolderRenameWithStableUIDs(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("parent and nested child folder rename preserves both stable UIDs", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-nested-rename-stable"
		const parentUID = "nrs-parent-uid"
		const childUID = "nrs-child-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"team/_folder.json":         folderMetadataJSON(parentUID, "Team"),
			"team/project/_folder.json": folderMetadataJSON(childUID, "Project"),
			"team/project/dash.json":    common.DashboardJSON("nrs-dash", "Nested Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"team", "team/project"})

		parentBefore, err := helper.Folders.Resource.Get(ctx, parentUID, metav1.GetOptions{})
		require.NoError(t, err)
		parentSnap := common.SnapshotObject(t, parentBefore)

		childBefore, err := helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err)
		childSnap := common.SnapshotObject(t, childBefore)

		dashBefore, err := helper.DashboardsV1.Resource.Get(ctx, "nrs-dash", metav1.GetOptions{})
		require.NoError(t, err)
		dashSnap := common.SnapshotObject(t, dashBefore)

		// Rename the entire tree: team/ -> squad/
		_, err = local.Git("mv", "team", "squad")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "rename team to squad")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		// Parent folder updated in place with new source path.
		parentAfter, err := helper.Folders.Resource.Get(ctx, parentUID, metav1.GetOptions{})
		require.NoError(t, err, "parent folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "parent folder", parentSnap, common.SnapshotObject(t, parentAfter))

		parentSP, _, _ := unstructured.NestedString(parentAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "squad", parentSP)

		// Child folder updated in place and still parented under the renamed parent.
		childAfter, err := helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err, "child folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "child folder", childSnap, common.SnapshotObject(t, childAfter))

		childSP, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "squad/project", childSP)
		childParent, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, parentUID, childParent, "child should still be parented under renamed parent")

		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"squad", "squad/project"})

		// Dashboard updated in place under the renamed hierarchy.
		dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "nrs-dash", metav1.GetOptions{})
		require.NoError(t, err)
		common.RequireUpdatedInPlace(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"nrs-dash": {Title: "Nested Dashboard", SourcePath: "squad/project/dash.json", Folder: childUID},
		})
	})

	t.Run("three-level folder rename preserves all stable UIDs", func(t *testing.T) {
		helper := sharedGitHelper(t)
		ctx := context.Background()

		const repoName = "incr-3level-rename-stable"
		const grandparentUID = "3l-gp-uid"
		const parentUID = "3l-parent-uid"
		const childUID = "3l-child-uid"

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"org/_folder.json":              folderMetadataJSON(grandparentUID, "Org"),
			"org/team/_folder.json":         folderMetadataJSON(parentUID, "Team"),
			"org/team/project/_folder.json": folderMetadataJSON(childUID, "Project"),
			"org/team/project/dash.json":    common.DashboardJSON("3l-dash", "Deep Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{
			"org", "org/team", "org/team/project",
		})

		gpBefore, err := helper.Folders.Resource.Get(ctx, grandparentUID, metav1.GetOptions{})
		require.NoError(t, err)
		gpSnap := common.SnapshotObject(t, gpBefore)

		parentBefore, err := helper.Folders.Resource.Get(ctx, parentUID, metav1.GetOptions{})
		require.NoError(t, err)
		parentSnap := common.SnapshotObject(t, parentBefore)

		childBefore, err := helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err)
		childSnap := common.SnapshotObject(t, childBefore)

		// Rename the entire tree: org/ -> corp/
		_, err = local.Git("mv", "org", "corp")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "rename org to corp")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		// Grandparent updated in place.
		gpAfter, err := helper.Folders.Resource.Get(ctx, grandparentUID, metav1.GetOptions{})
		require.NoError(t, err, "grandparent folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "grandparent folder", gpSnap, common.SnapshotObject(t, gpAfter))

		gpSP, _, _ := unstructured.NestedString(gpAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "corp", gpSP)

		// Parent updated in place.
		parentAfter, err := helper.Folders.Resource.Get(ctx, parentUID, metav1.GetOptions{})
		require.NoError(t, err, "parent folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "parent folder", parentSnap, common.SnapshotObject(t, parentAfter))

		parentSP, _, _ := unstructured.NestedString(parentAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "corp/team", parentSP)
		parentParent, _, _ := unstructured.NestedString(parentAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, grandparentUID, parentParent)

		// Child updated in place.
		childAfter, err := helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err, "child folder should still exist with same UID")
		common.RequireUpdatedInPlace(t, "child folder", childSnap, common.SnapshotObject(t, childAfter))

		childSP, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/sourcePath")
		require.Equal(t, "corp/team/project", childSP)
		childParent, _, _ := unstructured.NestedString(childAfter.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, parentUID, childParent)

		common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{
			"corp", "corp/team", "corp/team/project",
		})

		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"3l-dash": {Title: "Deep Dashboard", SourcePath: "corp/team/project/dash.json", Folder: childUID},
		})
	})
}
