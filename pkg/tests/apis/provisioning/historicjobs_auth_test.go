package provisioning

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_HistoricJobsAuthorization(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "historicjobs-auth-test"
	testRepo := TestRepo{
		Name:               repo,
		Target:             "folder",
		Copies:             map[string]string{}, // No files needed for this test
		ExpectedDashboards: 0,
		ExpectedFolders:    1, // Repository creates a folder
	}
	helper.CreateRepo(t, testRepo)

	// Trigger a job to create a historic job entry
	jobSpec := provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	}
	body := asJSON(jobSpec)

	// Create a job as admin
	var statusCode int
	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("jobs").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(ctx).StatusCode(&statusCode)
	require.NoError(t, result.Error(), "should be able to create job")
	require.Equal(t, http.StatusAccepted, statusCode)

	// Wait for job to complete and become historic
	helper.AwaitJobs(t, repo)
	historicJob := helper.AwaitLatestHistoricJob(t, repo)
	require.NotNil(t, historicJob, "should have a historic job")

	historicJobName := historicJob.GetName()

	t.Run("admin can GET historic job", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("historicjobs").
			Name(historicJobName).
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "admin should be able to GET historic job")
		require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
	})

	t.Run("editor cannot GET historic job", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Get().
			Namespace("default").
			Resource("historicjobs").
			Name(historicJobName).
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "editor should not be able to GET historic job")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})

	t.Run("viewer cannot GET historic job", func(t *testing.T) {
		var statusCode int
		result := helper.ViewerREST.Get().
			Namespace("default").
			Resource("historicjobs").
			Name(historicJobName).
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "viewer should not be able to GET historic job")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})
}
