package jobs

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// Jobs can also be created through the generic CRUD endpoint. It must enforce
// the same per-action authorization as the repositories/{name}/jobs connector.
func TestIntegrationProvisioning_JobCRUDAuthorization(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "job-crud-auth-test"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies:     map[string]string{},
	})

	newJobBody := func(name string) []byte {
		return common.AsJSON(&provisioning.Job{
			TypeMeta: metav1.TypeMeta{
				APIVersion: provisioning.APIVERSION,
				Kind:       "Job",
			},
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
			Spec: provisioning.JobSpec{
				Action:     provisioning.JobActionPull,
				Repository: repo,
				Pull:       &provisioning.SyncJobOptions{},
			},
		})
	}

	t.Run("editor cannot create pull job via CRUD", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Post().
			Namespace("default").
			Resource("jobs").
			Body(newJobBody("crud-editor-pull")).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error(), "editor should not be able to create pull job")
		require.Equal(t, http.StatusForbidden, statusCode)
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})

	t.Run("admin can create pull job via CRUD", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("jobs").
			Body(newJobBody("crud-admin-pull")).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "admin should be able to create pull job")
		require.Equal(t, http.StatusCreated, statusCode)

		helper.AwaitJobs(t, repo)
	})
}
