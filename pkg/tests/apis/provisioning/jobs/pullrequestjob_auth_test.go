package jobs

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_PullRequestJobRejected(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "pr-job-rejected-test"
	testRepo := common.TestRepo{
		Name:               repo,
		SyncTarget:         "folder",
		Copies:             map[string]string{},
		ExpectedDashboards: 0,
		ExpectedFolders:    1,
	}
	helper.CreateLocalRepo(t, testRepo)

	body := common.AsJSON(provisioning.JobSpec{
		Action: provisioning.JobActionPullRequest,
		PullRequest: &provisioning.PullRequestJobOptions{
			PR:  123,
			Ref: "test-ref",
		},
	})

	t.Run("admin cannot create pull request job", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "admin should not be able to create pull request job")
		require.Equal(t, http.StatusBadRequest, statusCode, "should return 400 Bad Request")
		require.True(t, apierrors.IsBadRequest(result.Error()), "error should be bad request")
	})

	t.Run("editor cannot create pull request job", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "editor should not be able to create pull request job")
		require.Equal(t, http.StatusBadRequest, statusCode, "should return 400 Bad Request")
		require.True(t, apierrors.IsBadRequest(result.Error()), "error should be bad request")
	})

	t.Run("viewer cannot create pull request job", func(t *testing.T) {
		var statusCode int
		result := helper.ViewerREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "viewer should not be able to create pull request job")
		// Viewer is blocked at the API authorization layer (403) before reaching the connector
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})
}
