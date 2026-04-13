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

func TestIntegrationProvisioning_DeleteResourcesJobAuthorization(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	body := common.AsJSON(provisioning.JobSpec{
		Action:     provisioning.JobActionDeleteResources,
		Repository: "nonexistent-repo",
	})

	t.Run("admin can create deleteResources job for nonexistent repo", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("nonexistent-repo").
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "admin should be able to create deleteResources job for nonexistent repo")
		require.Equal(t, http.StatusAccepted, statusCode, "should return 202 Accepted")
	})

	t.Run("editor cannot create deleteResources job", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("nonexistent-repo").
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "editor should not be able to create deleteResources job")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})

	t.Run("viewer cannot create deleteResources job", func(t *testing.T) {
		var statusCode int
		result := helper.ViewerREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("nonexistent-repo").
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "viewer should not be able to create deleteResources job")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})

	t.Run("deleteResources rejected when repository exists and is healthy", func(t *testing.T) {
		const repo = "deleteresources-conflict-test"
		testRepo := common.TestRepo{
			Name:               repo,
			SyncTarget:         "folder",
			Copies:             map[string]string{},
			ExpectedDashboards: 0,
			ExpectedFolders:    1,
		}
		helper.CreateLocalRepo(t, testRepo)

		existingRepoBody := common.AsJSON(provisioning.JobSpec{
			Action:     provisioning.JobActionDeleteResources,
			Repository: repo,
		})

		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(existingRepoBody).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "deleteResources should be rejected for a healthy repository")
		require.Equal(t, http.StatusConflict, statusCode, "should return 409 Conflict")
		require.True(t, apierrors.IsConflict(result.Error()), "error should be conflict")
	})
}
