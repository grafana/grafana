package jobs

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_OrphanCleanupJobGetEndpoint verifies that the
// GET /repositories/{name}/jobs endpoint works for orphan cleanup jobs even
// when the repository does not exist. This is critical because these jobs are
// specifically created for missing or terminating repositories.
func TestIntegrationProvisioning_OrphanCleanupJobGetEndpoint(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	for _, action := range []provisioning.JobAction{
		provisioning.JobActionReleaseResources,
		provisioning.JobActionDeleteResources,
	} {
		t.Run(string(action), func(t *testing.T) {
			const repo = "orphan-get-test"

			body := common.AsJSON(provisioning.JobSpec{
				Action:     action,
				Repository: repo,
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
			require.NoError(t, result.Error(), "admin should be able to create %s job", action)
			require.Equal(t, http.StatusAccepted, statusCode)

			obj, err := result.Get()
			require.NoError(t, err, "should parse created job response")
			createdJob, ok := obj.(*unstructured.Unstructured)
			require.True(t, ok, "expected unstructured object, got %T", obj)

			jobUID := string(createdJob.GetUID())
			require.NotEmpty(t, jobUID, "created job should have a UID")

			// Wait for the job to appear in historic jobs (completes quickly
			// because there are no managed resources for a nonexistent repo).
			var historicJob *unstructured.Unstructured
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				got, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "jobs", jobUID)
				if !assert.NoError(collect, err, "GET by UID should succeed for nonexistent repo") {
					return
				}
				historicJob = got
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "job should become visible via GET by UID")
			require.NotNil(t, historicJob)

			t.Run("GET by UID returns correct job", func(t *testing.T) {
				gotAction := common.MustNestedString(historicJob.Object, "spec", "action")
				assert.Equal(t, string(action), gotAction, "returned job should have matching action")

				gotRepo := common.MustNestedString(historicJob.Object, "spec", "repository")
				assert.Equal(t, repo, gotRepo, "returned job should reference the orphan repo")
			})

			t.Run("GET job list returns at least one job", func(t *testing.T) {
				listResult, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "jobs")
				require.NoError(t, err, "GET job list should succeed for nonexistent repo")

				list, err := listResult.ToList()
				require.NoError(t, err, "result should be a list")
				require.NotEmpty(t, list.Items, "should have at least one historic job")

				found := false
				for _, item := range list.Items {
					if string(item.GetUID()) == jobUID ||
						common.MustNestedString(item.Object, "metadata", "labels", "provisioning.grafana.app/original-uid") == jobUID {
						found = true
						break
					}
				}
				assert.True(t, found, "job list should contain the created job (UID %s)", jobUID)
			})
		})
	}
}
