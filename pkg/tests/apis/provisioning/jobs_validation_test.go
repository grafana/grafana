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

func TestIntegrationProvisioning_WritePermissionValidation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	const repoReadOnly = "job-validation-readonly"
	testRepo := TestRepo{
		Name:               repoReadOnly,
		Template:           "testdata/local-readonly.json.tmpl",
		Target:             "folder",
		Copies:             map[string]string{},
		ExpectedDashboards: 0,
		ExpectedFolders:    1,
	}
	helper.CreateRepo(t, testRepo)

	t.Run("write jobs should be rejected for read-only repositories", func(t *testing.T) {
		writeJobs := []struct {
			name   string
			action provisioning.JobAction
			spec   provisioning.JobSpec
		}{
			{
				name:   "delete job",
				action: provisioning.JobActionDelete,
				spec: provisioning.JobSpec{
					Action: provisioning.JobActionDelete,
					Delete: &provisioning.DeleteJobOptions{
						Paths: []string{"test.json"},
					},
				},
			},
			{
				name:   "move job",
				action: provisioning.JobActionMove,
				spec: provisioning.JobSpec{
					Action: provisioning.JobActionMove,
					Move: &provisioning.MoveJobOptions{
						Paths:      []string{"test.json"},
						TargetPath: "new/",
					},
				},
			},
			{
				name:   "push job",
				action: provisioning.JobActionPush,
				spec: provisioning.JobSpec{
					Action: provisioning.JobActionPush,
					Push: &provisioning.ExportJobOptions{
						Message: "test commit",
					},
				},
			},
			{
				name:   "migrate job",
				action: provisioning.JobActionMigrate,
				spec: provisioning.JobSpec{
					Action: provisioning.JobActionMigrate,
					Migrate: &provisioning.MigrateJobOptions{
						Message: "test migration",
					},
				},
			},
		}

		for _, test := range writeJobs {
			t.Run(test.name, func(t *testing.T) {
				body := asJSON(test.spec)

				var statusCode int
				result := helper.AdminREST.Post().
					Namespace("default").
					Resource("repositories").
					Name(repoReadOnly).
					SubResource("jobs").
					Body(body).
					SetHeader("Content-Type", "application/json").
					Do(ctx).StatusCode(&statusCode)

				require.Error(t, result.Error(), "write job should be rejected for read-only repository")
				require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
				require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
				require.Contains(t, result.Error().Error(), "write operations are not allowed for this repository", "error message should indicate write operations not allowed")
			})
		}
	})

	t.Run("pull job should be allowed for read-only repositories", func(t *testing.T) {
		body := asJSON(provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoReadOnly).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "pull job should be allowed for read-only repository")
		require.Equal(t, http.StatusAccepted, statusCode, "should return 202 Accepted")

		helper.AwaitJobs(t, repoReadOnly)
	})
}
