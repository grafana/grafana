package jobs

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_PullJobAuthorization(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "pull-auth-test"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies:     map[string]string{},
	}
	helper.CreateLocalRepo(t, testRepo)

	helper.RequireRepoDashboardCount(t, repo, 0)
	helper.RequireRepoFolderCount(t, repo, 1)

	body := common.AsJSON(provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	t.Run("admin can create pull job", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "admin should be able to create pull job")
		require.Equal(t, http.StatusAccepted, statusCode, "should return 202 Accepted")

		helper.AwaitJobs(t, repo)
	})

	t.Run("editor cannot create pull job", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error(), "editor should not be able to create pull job")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})

	t.Run("viewer cannot create pull job", func(t *testing.T) {
		var statusCode int
		result := helper.ViewerREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error(), "viewer should not be able to create pull job")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})
}
