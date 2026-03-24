package foldermetadata

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_FixFolderMetadataJob(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "fix-folder-metadata-test-repo"
	testRepo := common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"../../testdata/all-panels.json": "dashboard1.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    1,
	}
	helper.CreateRepo(t, testRepo)

	t.Run("job completes successfully", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionFixFolderMetadata,
		}

		job := helper.TriggerJobAndWaitForComplete(t, repo, spec)
		state := common.MustNestedString(job.Object, "status", "state")
		if state != "success" {
			if msg, ok := job.Object["status"].(map[string]interface{})["message"].(string); ok {
				t.Logf("Job error message: %s", msg)
			}
			if errs, ok := job.Object["status"].(map[string]interface{})["errors"].([]interface{}); ok {
				t.Logf("Job errors: %v", errs)
			}
		}
		require.Equal(t, "success", state, "fix-folder-metadata job should complete with success")
	})

	t.Run("job with explicit empty ref completes successfully", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionFixFolderMetadata,
			FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{
				Ref: "",
			},
		}

		job := helper.TriggerJobAndWaitForComplete(t, repo, spec)
		state := common.MustNestedString(job.Object, "status", "state")
		require.Equal(t, "success", state, "fix-folder-metadata job with explicit empty ref should complete with success")
	})

	t.Run("job with empty options uses default ref", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action:            provisioning.JobActionFixFolderMetadata,
			FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{},
		}

		job := helper.TriggerJobAndWaitForComplete(t, repo, spec)
		state := common.MustNestedString(job.Object, "status", "state")
		require.Equal(t, "success", state, "fix-folder-metadata job with empty options should complete with success")
	})
}

func TestIntegrationProvisioning_FixFolderMetadataJobAuthorization(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "fixfoldermetadata-auth-test"
	testRepo := common.TestRepo{
		Name:               repo,
		Target:             "folder",
		Copies:             map[string]string{},
		ExpectedDashboards: 0,
		ExpectedFolders:    1,
	}
	helper.CreateRepo(t, testRepo)

	body := common.AsJSON(provisioning.JobSpec{
		Action: provisioning.JobActionFixFolderMetadata,
	})

	t.Run("admin can create fixFolderMetadata job", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "admin should be able to create fixFolderMetadata job")
		require.Equal(t, http.StatusAccepted, statusCode, "should return 202 Accepted")

		helper.AwaitJobs(t, repo)
	})

	t.Run("editor can create fixFolderMetadata job", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "editor should be able to create fixFolderMetadata job")
		require.Equal(t, http.StatusAccepted, statusCode, "should return 202 Accepted")

		helper.AwaitJobs(t, repo)
	})

	t.Run("viewer cannot create fixFolderMetadata job", func(t *testing.T) {
		var statusCode int
		result := helper.ViewerREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "viewer should not be able to create fixFolderMetadata job")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})
}

func TestIntegrationProvisioning_JobsAuthorization(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "jobs-auth-test"
	testRepo := common.TestRepo{
		Name:               repo,
		Target:             "folder",
		Copies:             map[string]string{},
		ExpectedDashboards: 0,
		ExpectedFolders:    1,
	}
	helper.CreateRepo(t, testRepo)

	t.Run("admin can LIST jobs", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("jobs").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "admin should be able to LIST jobs")
		require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
	})

	t.Run("editor can LIST jobs", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Get().
			Namespace("default").
			Resource("jobs").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "editor should be able to LIST jobs")
		require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
	})

	t.Run("viewer cannot LIST jobs", func(t *testing.T) {
		var statusCode int
		result := helper.ViewerREST.Get().
			Namespace("default").
			Resource("jobs").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "viewer should not be able to LIST jobs")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})

	t.Run("admin can create job", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "admin should be able to create job")
		require.Equal(t, http.StatusAccepted, statusCode, "should return 202 Accepted")

		helper.AwaitJobs(t, repo)
	})

	t.Run("editor can create job", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionFixFolderMetadata,
		})

		var statusCode int
		result := helper.EditorREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "editor should be able to create job")
		require.Equal(t, http.StatusAccepted, statusCode, "should return 202 Accepted")

		helper.AwaitJobs(t, repo)
	})

	t.Run("viewer cannot create job", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionFixFolderMetadata,
		})

		var statusCode int
		result := helper.ViewerREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "viewer should not be able to create job")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})
}
