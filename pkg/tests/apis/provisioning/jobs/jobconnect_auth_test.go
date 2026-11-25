package jobs

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// The jobs connector (repositories/{name}/jobs) queues jobs through the Job CRUD
// store, so its authorization is enforced by admission. This guards that a denied
// request is rejected and leaves no Job behind.
func TestIntegrationProvisioning_JobConnectAuthorization(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "job-connect-auth-test"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies:     map[string]string{},
	})

	body := common.AsJSON(provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	t.Run("editor and viewer are rejected and no job is queued", func(t *testing.T) {
		for name, client := range map[string]*rest.RESTClient{
			"editor": helper.EditorREST,
			"viewer": helper.ViewerREST,
		} {
			t.Run(name, func(t *testing.T) {
				var statusCode int
				// Hitting jobs.Connect by making a POST through the subresource: `/repositories/<repo>/jobs`
				// rather than directly making POST to `/jobs`
				result := client.Post().
					Namespace("default").
					Resource("repositories").
					Name(repo).
					SubResource("jobs").
					Body(body).
					SetHeader("Content-Type", "application/json").
					Do(t.Context()).StatusCode(&statusCode)

				require.Error(t, result.Error())
				require.Equal(t, http.StatusForbidden, statusCode)
				require.True(t, apierrors.IsForbidden(result.Error()))

				list, err := helper.Jobs.Resource.List(t.Context(), metav1.ListOptions{})
				require.NoError(t, err)
				for _, item := range list.Items {
					require.NotEqual(t, repo, item.GetLabels()[jobs.LabelRepository],
						"a rejected request must not leave a job in the queue")
				}
			})
		}
	})

	t.Run("admin can queue a pull job", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.NoError(t, result.Error())
		require.Equal(t, http.StatusAccepted, statusCode)

		helper.AwaitJobs(t, repo)
	})
}
