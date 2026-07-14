package instanceauth

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_ExportJobAuthorization(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "export-auth-test"
	testRepo := common.TestRepo{
		Name:               repo,
		SyncTarget:         "instance",
		Workflows:          []string{"write"},
		Copies:             map[string]string{},
		ExpectedDashboards: 0,
		ExpectedFolders:    0,
	}
	helper.CreateLocalRepo(t, testRepo)

	t.Run("admin can create export job", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionPush,
			Push:   &provisioning.ExportJobOptions{},
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

		require.NoError(t, result.Error(), "admin should be able to create export job")
		require.Equal(t, http.StatusAccepted, statusCode, "should return 202 Accepted")

		helper.AwaitJobs(t, repo)
	})

	t.Run("editor cannot create export job on instance-scoped repo", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionPush,
			Push:   &provisioning.ExportJobOptions{},
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

		require.Error(t, result.Error(), "editor should not be able to export on instance-scoped repo")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})

	t.Run("viewer cannot create export job", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionPush,
			Push:   &provisioning.ExportJobOptions{},
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

		require.Error(t, result.Error(), "viewer should not be able to create export job")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})
}
