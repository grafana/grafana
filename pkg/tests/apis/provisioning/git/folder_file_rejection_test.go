package git

import (
	"context"
	"encoding/json"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
)

// folderJSON generates a valid folder resource JSON file that the provisioning
// parser should reject with "cannot declare folders through files".
func folderJSON(uid, title string) []byte {
	folder := map[string]interface{}{
		"apiVersion": "folder.grafana.app/v1",
		"kind":       "Folder",
		"metadata": map[string]interface{}{
			"name": uid,
		},
		"spec": map[string]interface{}{
			"title": title,
		},
	}
	data, _ := json.MarshalIndent(folder, "", "\t")
	return data
}

// TestIntegrationProvisioning_FullSync_FolderFileIsWarning verifies that a
// folder-typed JSON file produces a warning (not an error) during full sync.
func TestIntegrationProvisioning_FullSync_FolderFileIsWarning(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "full-folder-file-warning"

	helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("full-folder-dash", "Dashboard", 1),
		"folder.json":    folderJSON("folder-uid", "A Folder"),
	})

	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	require.Empty(t, jobObj.Status.Errors,
		"folder file should produce a warning, not an error")
	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"full sync should finish in warning state when a folder file is present")
	require.NotEmpty(t, jobObj.Status.Warnings,
		"full sync should produce at least one warning for the folder file")
	common.RequireJobWarningContains(t, jobObj, "cannot declare folders through files")

	common.RequireRepoDashboardCount(t, helper, ctx, repoName, 1)
}

// TestIntegrationProvisioning_IncrementalSync_FolderFileCreateIsWarning
// verifies that when a folder-typed JSON file is added to git, incremental
// sync produces a warning rather than an error.
func TestIntegrationProvisioning_IncrementalSync_FolderFileCreateIsWarning(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "incr-folder-file-create"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("folder-create-dash", "Dashboard", 1),
	})

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireRepoDashboardCount(t, helper, ctx, repoName, 1)

	require.NoError(t, local.CreateFile("new-folder.json", string(folderJSON("new-folder", "New Folder"))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "add folder file")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: true},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	require.Empty(t, jobObj.Status.Errors,
		"folder file creation should NOT produce errors")
	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"incremental sync should finish in warning state when a folder file is created")
	require.NotEmpty(t, jobObj.Status.Warnings,
		"incremental sync should produce at least one warning for the folder file")
	common.RequireJobWarningContains(t, jobObj, "cannot declare folders through files")

	common.RequireRepoDashboardCount(t, helper, ctx, repoName, 1)
}

// TestIntegrationProvisioning_IncrementalSync_FolderFileDeletedIsWarning
// verifies that when a folder-typed JSON file is deleted from git, incremental
// sync produces a warning rather than a hard error, because folder lifecycle is
// managed by directory structure, not file content.
func TestIntegrationProvisioning_IncrementalSync_FolderFileDeletedIsWarning(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "incr-folder-file-delete"

	// Seed the repo with a dashboard and a folder-typed JSON file.
	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("folder-test-dash", "Dashboard", 1),
		"my-folder.json": folderJSON("my-folder-uid", "My Folder"),
	})

	// Full sync: the dashboard is imported; the folder file produces a warning.
	helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	common.RequireRepoDashboardCount(t, helper, ctx, repoName, 1)

	// Delete the folder file from git.
	_, err := local.Git("rm", "my-folder.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "remove folder file")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	// Incremental sync should handle the deletion gracefully.
	incrJob := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: true},
	})
	incrJobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(incrJob.Object, incrJobObj))

	require.Empty(t, incrJobObj.Status.Errors,
		"folder file deletion should NOT produce errors")
	require.Equal(t, provisioning.JobStateWarning, incrJobObj.Status.State,
		"incremental sync should finish in warning state when a folder file is deleted")
	require.NotEmpty(t, incrJobObj.Status.Warnings,
		"incremental sync should produce at least one warning for the deleted folder file")
	common.RequireJobWarningContains(t, incrJobObj, "cannot declare folders through files")

	common.RequireRepoDashboardCount(t, helper, ctx, repoName, 1)
}

// TestIntegrationGitFiles_CreateFolderFileRejected verifies that creating a
// folder-typed resource via the POST /files/ endpoint is rejected with BadRequest.
func TestIntegrationGitFiles_CreateFolderFileRejected(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	repoName := "test-create-folder-file"
	_, _ = helper.CreateGitRepo(t, repoName, nil, "write")

	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("files", "my-folder.json").
		Param("message", "Create folder file").
		Body(folderJSON("new-folder", "New Folder")).
		SetHeader("Content-Type", "application/json").
		Do(ctx)

	require.Error(t, result.Error(), "creating a folder file should be rejected")
	require.True(t, apierrors.IsBadRequest(result.Error()),
		"error should be a BadRequest (validation error), got: %v", result.Error())
}

// TestIntegrationGitFiles_DeleteFolderFileRejected verifies that deleting a
// folder-typed file via the DELETE /files/ endpoint is rejected with BadRequest.
func TestIntegrationGitFiles_DeleteFolderFileRejected(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	repoName := "test-delete-folder-file"
	_, _ = helper.CreateGitRepo(t, repoName, map[string][]byte{
		"my-folder.json": folderJSON("del-folder", "Delete Me"),
	}, "write")

	result := helper.AdminREST.Delete().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("files", "my-folder.json").
		Param("message", "Delete folder file").
		Do(ctx)

	require.Error(t, result.Error(), "deleting a folder file should be rejected")
	require.True(t, apierrors.IsBadRequest(result.Error()),
		"error should be a BadRequest (validation error), got: %v", result.Error())
}

// TestIntegrationGitFiles_UpdateFolderFileRejected verifies that updating a
// folder-typed file via the PUT /files/ endpoint is rejected with BadRequest.
func TestIntegrationGitFiles_UpdateFolderFileRejected(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	repoName := "test-update-folder-file"
	_, _ = helper.CreateGitRepo(t, repoName, map[string][]byte{
		"my-folder.json": folderJSON("upd-folder", "Original"),
	}, "write")

	result := helper.AdminREST.Put().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("files", "my-folder.json").
		Param("message", "Update folder file").
		Body(folderJSON("upd-folder", "Updated")).
		SetHeader("Content-Type", "application/json").
		Do(ctx)

	require.Error(t, result.Error(), "updating a folder file should be rejected")
	require.True(t, apierrors.IsBadRequest(result.Error()),
		"error should be a BadRequest (validation error), got: %v", result.Error())
}
