package incremental

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_IncrementalSync_InvalidFolderMetadata(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := sharedGitHelper(t)

	t.Run("invalid metadata creation on existing folder keeps unstable uid and reconciles changed child", func(t *testing.T) {
		ctx := context.Background()
		const repoName = "incr-invalid-meta-existing"
		t.Cleanup(func() {
			require.NoError(t, helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{}))
		})

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"team/dashboard.json": common.DashboardJSON("team-dash", "Team Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())
		oldUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "team")

		require.NoError(t, local.CreateFile("team/_folder.json", string(invalidFolderMetadataJSON("Broken Team"))))
		require.NoError(t, local.CreateFile("team/dashboard.json", string(common.DashboardJSON("team-dash", "Team Dashboard Updated", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add invalid folder metadata to existing folder")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Empty(t, jobObj.Status.Errors)
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
		requireInvalidFolderMetadataWarning(t, jobObj, "team/", repository.FileActionCreated)

		common.RequireRepoFolderUID(t, helper.Folders, ctx, repoName, oldUID)
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "team/dashboard.json", oldUID)
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"team-dash": {Title: "Team Dashboard Updated", SourcePath: "team/dashboard.json", Folder: oldUID},
		})
	})

	t.Run("invalid metadata on new folder falls back to unstable uid and reconciles children", func(t *testing.T) {
		ctx := context.Background()
		const repoName = "incr-invalid-meta-new"
		t.Cleanup(func() {
			require.NoError(t, helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{}))
		})

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"root.json": common.DashboardJSON("root-dash", "Root Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		require.NoError(t, local.CreateFile("team/_folder.json", string(invalidFolderMetadataJSON("Broken Team"))))
		require.NoError(t, local.CreateFile("team/dashboard.json", string(common.DashboardJSON("team-dash", "Team Dashboard", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add new folder with invalid metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Empty(t, jobObj.Status.Errors)
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
		requireInvalidFolderMetadataWarning(t, jobObj, "team/", repository.FileActionCreated)

		folderUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "team")
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "team/dashboard.json", folderUID)
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"root-dash": {Title: "Root Dashboard", SourcePath: "root.json"},
			"team-dash": {Title: "Team Dashboard", SourcePath: "team/dashboard.json", Folder: folderUID},
		})
	})

	t.Run("invalid metadata update on stable folder keeps stable uid and reconciles changed child", func(t *testing.T) {
		ctx := context.Background()
		const repoName = "incr-invalid-meta-update"
		const stableUID = "team-stable-uid"
		t.Cleanup(func() {
			require.NoError(t, helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{}))
		})

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"team/_folder.json":   folderMetadataJSON(stableUID, "Team"),
			"team/dashboard.json": common.DashboardJSON("team-dash", "Team Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		require.NoError(t, local.CreateFile("team/_folder.json", string(invalidFolderMetadataJSON("Broken Team"))))
		require.NoError(t, local.CreateFile("team/dashboard.json", string(common.DashboardJSON("team-dash", "Team Dashboard Updated", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "break existing folder metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Empty(t, jobObj.Status.Errors)
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
		requireInvalidFolderMetadataWarning(t, jobObj, "team/", repository.FileActionUpdated)

		common.RequireRepoFolderUID(t, helper.Folders, ctx, repoName, stableUID)
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "team/dashboard.json", stableUID)
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"team-dash": {Title: "Team Dashboard Updated", SourcePath: "team/dashboard.json", Folder: stableUID},
		})
	})

	t.Run("follow-up child update under already-invalid metadata keeps the existing stable uid", func(t *testing.T) {
		ctx := context.Background()
		const repoName = "incr-invalid-meta-follow-up-child"
		const stableUID = "team-stable-uid"
		t.Cleanup(func() {
			require.NoError(t, helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{}))
		})

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"team/_folder.json":   folderMetadataJSON(stableUID, "Team"),
			"team/dashboard.json": common.DashboardJSON("team-dash", "Team Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		require.NoError(t, local.CreateFile("team/_folder.json", string(invalidFolderMetadataJSON("Broken Team"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "break folder metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))
		require.Empty(t, jobObj.Status.Errors)
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
		requireInvalidFolderMetadataWarning(t, jobObj, "team/", repository.FileActionUpdated)

		require.NoError(t, local.CreateFile("team/dashboard.json", string(common.DashboardJSON("team-dash", "Team Dashboard Follow-up", 2))))
		_, err = local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "update child under already-invalid metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		job = helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj = &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))
		require.Empty(t, jobObj.Status.Errors)
		require.Equal(t, provisioning.JobStateSuccess, jobObj.Status.State)

		common.RequireRepoFolderUID(t, helper.Folders, ctx, repoName, stableUID)
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "team/dashboard.json", stableUID)
		common.RequireRepoFolderCount(t, helper, ctx, repoName, 1)
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"team-dash": {Title: "Team Dashboard Follow-up", SourcePath: "team/dashboard.json", Folder: stableUID},
		})
	})

	t.Run("invalid metadata creation on existing folder does not break valid folder meta creation on another folder in the same incremental sync", func(t *testing.T) {
		ctx := context.Background()
		const repoName = "incr-invalid-meta-with-valid-replaced"
		const parentStableUID = "parent-stable-uid"
		const childUID = "child-stable-uid"
		t.Cleanup(func() {
			require.NoError(t, helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{}))
		})

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"broken/dashboard.json":         common.DashboardJSON("broken-dash", "Broken Dashboard", 1),
			"parent/child/_folder.json":     folderMetadataJSON(childUID, "Child"),
			"parent/child/dashboard.json":   common.DashboardJSON("child-dash", "Child Dashboard", 1),
			"parent/child/second-dash.json": common.DashboardJSON("child-dash-2", "Child Dashboard Two", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())

		oldBrokenUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "broken")
		oldParentUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "parent")
		require.NotEqual(t, parentStableUID, oldParentUID, "parent should start with an unstable uid")
		common.RequireFolderState(t, helper.Folders, childUID, "Child", "parent/child", oldParentUID)

		require.NoError(t, local.CreateFile("broken/_folder.json", string(invalidFolderMetadataJSON("Broken Folder"))))
		require.NoError(t, local.CreateFile("parent/_folder.json", string(folderMetadataJSON(parentStableUID, "Parent"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "mix invalid metadata with valid parent replacement")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Empty(t, jobObj.Status.Errors)
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
		requireInvalidFolderMetadataWarning(t, jobObj, "broken/", repository.FileActionCreated)

		common.RequireRepoFolderUID(t, helper.Folders, ctx, repoName, parentStableUID)
		common.RequireFolderState(t, helper.Folders, childUID, "Child", "parent/child", parentStableUID)
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "parent/child/dashboard.json", childUID)
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "parent/child/second-dash.json", childUID)

		_, err = helper.Folders.Resource.Get(ctx, oldParentUID, metav1.GetOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsNotFound(err), "old unstable parent folder should be deleted")

		common.RequireRepoFolderUID(t, helper.Folders, ctx, repoName, oldBrokenUID)
	})

	t.Run("moving a resource into an existing folder with invalid metadata still works", func(t *testing.T) {
		ctx := context.Background()
		const repoName = "incr-invalid-meta-move-into-existing"
		t.Cleanup(func() {
			require.NoError(t, helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{}))
		})

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"team/_folder.json": invalidFolderMetadataJSON("Broken Team"),
			"root.json":         common.DashboardJSON("root-dash", "Root Dashboard", 1),
		})

		helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		folderUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "team")

		_, err := local.Git("mv", "root.json", "team/root.json")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move dashboard into existing invalid folder")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Empty(t, jobObj.Status.Errors)
		require.Equal(t, provisioning.JobStateSuccess, jobObj.Status.State)
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "team/root.json", folderUID)
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"root-dash": {Title: "Root Dashboard", SourcePath: "team/root.json", Folder: folderUID},
		})
	})

	t.Run("moving a resource into a new folder with invalid metadata falls back to unstable uid", func(t *testing.T) {
		ctx := context.Background()
		const repoName = "incr-invalid-meta-move-into-new"
		t.Cleanup(func() {
			require.NoError(t, helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{}))
		})

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"root.json": common.DashboardJSON("root-dash", "Root Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		require.NoError(t, local.CreateFile("team/_folder.json", string(invalidFolderMetadataJSON("Broken Team"))))
		_, err := local.Git("mv", "root.json", "team/")
		require.NoError(t, err)
		_, err = local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move dashboard into new invalid folder")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Empty(t, jobObj.Status.Errors)
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
		requireInvalidFolderMetadataWarning(t, jobObj, "team/", repository.FileActionCreated)

		folderUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "team")
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "team/root.json", folderUID)
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"root-dash": {Title: "Root Dashboard", SourcePath: "team/root.json", Folder: folderUID},
		})
	})

	t.Run("moving a folder with invalid metadata falls back to delete and recreate", func(t *testing.T) {
		ctx := context.Background()
		const repoName = "incr-invalid-meta-folder-move"
		const stableUID = "team-stable-uid"
		t.Cleanup(func() {
			require.NoError(t, helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{}))
		})

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"team/_folder.json":   folderMetadataJSON(stableUID, "Team"),
			"team/dashboard.json": common.DashboardJSON("team-dash", "Team Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		_, err := local.Git("mv", "team", "moved")
		require.NoError(t, err)
		require.NoError(t, local.CreateFile("moved/_folder.json", string(invalidFolderMetadataJSON("Broken Team"))))
		_, err = local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move folder with invalid metadata")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Empty(t, jobObj.Status.Errors)
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
		requireInvalidFolderMetadataWarning(t, jobObj, "moved/", repository.FileActionCreated)

		_, err = helper.Folders.Resource.Get(ctx, stableUID, metav1.GetOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsNotFound(err))

		newUID := common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "moved")
		require.NotEqual(t, stableUID, newUID)

		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "moved/dashboard.json", newUID)
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"team-dash": {Title: "Team Dashboard", SourcePath: "moved/dashboard.json", Folder: newUID},
		})
	})

	t.Run("invalid metadata creation does not break valid metadata-backed folder rename in the same incremental sync", func(t *testing.T) {
		ctx := context.Background()
		const repoName = "incr-invalid-meta-with-valid-rename"
		const parentStableUID = "parent-stable-uid"
		const childUID = "child-stable-uid"
		t.Cleanup(func() {
			require.NoError(t, helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{}))
		})

		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"old-parent/_folder.json":         folderMetadataJSON(parentStableUID, "Parent"),
			"old-parent/child/_folder.json":   folderMetadataJSON(childUID, "Child"),
			"old-parent/child/dashboard.json": common.DashboardJSON("child-dash", "Child Dashboard", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		common.RequireFolderState(t, helper.Folders, parentStableUID, "Parent", "old-parent", "")
		common.RequireFolderState(t, helper.Folders, childUID, "Child", "old-parent/child", parentStableUID)

		require.NoError(t, local.CreateFile("broken/_folder.json", string(invalidFolderMetadataJSON("Broken Folder"))))
		require.NoError(t, local.CreateFile("broken/dashboard.json", string(common.DashboardJSON("broken-dash", "Broken Dashboard", 1))))
		_, err := local.Git("mv", "old-parent", "new-parent")
		require.NoError(t, err)
		_, err = local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "mix invalid metadata with valid folder rename")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Empty(t, jobObj.Status.Errors)
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
		requireInvalidFolderMetadataWarning(t, jobObj, "broken/", repository.FileActionCreated)

		common.RequireFolderState(t, helper.Folders, parentStableUID, "Parent", "new-parent", "")
		common.RequireFolderState(t, helper.Folders, childUID, "Child", "new-parent/child", parentStableUID)
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repoName, "new-parent/child/dashboard.json", childUID)
		common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
			"broken-dash": {Title: "Broken Dashboard", SourcePath: "broken/dashboard.json", Folder: common.RequireRepoFolderTitle(t, helper.Folders, ctx, repoName, "broken")},
			"child-dash":  {Title: "Child Dashboard", SourcePath: "new-parent/child/dashboard.json", Folder: childUID},
		})
	})
}

func invalidFolderMetadataJSON(title string) []byte {
	folder := map[string]any{
		"apiVersion": "folder.grafana.app/v1",
		"kind":       "Folder",
		"metadata":   map[string]any{},
		"spec": map[string]any{
			"title": title,
		},
	}
	data, _ := json.MarshalIndent(folder, "", "\t")
	return data
}

func requireInvalidFolderMetadataWarning(t *testing.T, jobObj *provisioning.Job, path string, action repository.FileAction) {
	t.Helper()
	for _, warning := range jobObj.Status.Warnings {
		if strings.Contains(warning, "invalid folder metadata") &&
			strings.Contains(warning, path) &&
			strings.Contains(warning, "action: "+string(action)) {
			return
		}
	}
	t.Fatalf("expected invalid folder metadata warning for %q with action %q, got: %v", path, action, jobObj.Status.Warnings)
}
