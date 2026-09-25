package foldermetadata

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_JobsAuthorization(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "jobs-auth-test"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Workflows:  []string{"write"},
		Copies:     map[string]string{},
	}
	helper.CreateLocalRepo(t, testRepo)

	helper.RequireRepoDashboardCount(t, repo, 0)
	helper.RequireRepoFolderCount(t, repo, 1)

	t.Run("admin can LIST jobs", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("jobs").
			Do(t.Context()).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "admin should be able to LIST jobs")
		require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
	})

	t.Run("editor can LIST jobs", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Get().
			Namespace("default").
			Resource("jobs").
			Do(t.Context()).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "editor should be able to LIST jobs")
		require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
	})

	t.Run("viewer cannot LIST jobs", func(t *testing.T) {
		var statusCode int
		result := helper.ViewerREST.Get().
			Namespace("default").
			Resource("jobs").
			Do(t.Context()).StatusCode(&statusCode)

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
			Do(t.Context()).StatusCode(&statusCode)

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
			Do(t.Context()).StatusCode(&statusCode)

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
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error(), "viewer should not be able to create job")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})
}
