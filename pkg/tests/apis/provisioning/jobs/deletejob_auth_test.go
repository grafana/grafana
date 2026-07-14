package jobs

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_DeleteJobAuthorization(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "delete-auth-test"
	testRepo := common.TestRepo{
		Name:      repo,
		Workflows: []string{"write"},
		Copies: map[string]string{
			"../testdata/all-panels.json": "dashboard.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    0,
	}
	helper.CreateLocalRepo(t, testRepo)

	// Grant the editor user dashboard permissions (the default editor role
	// does not include dashboards:delete which is required by the pre-flight check).
	helper.SetPermissions(helper.Org1.Editor, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           []string{"dashboards:read", "dashboards:write", "dashboards:delete"},
			Resource:          "dashboards",
			ResourceAttribute: "uid",
			ResourceID:        "*",
		},
	})

	t.Run("admin can create delete job", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"dashboard.json"},
			},
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

		require.NoError(t, result.Error(), "admin should be able to create delete job")
		require.Equal(t, http.StatusAccepted, statusCode, "should return 202 Accepted")

		helper.AwaitJobs(t, repo)
	})

	t.Run("editor can create delete job", func(t *testing.T) {
		helper.CopyToProvisioningPath(t, "../testdata/all-panels.json", "editor-dash.json")
		helper.SyncAndWait(t, repo, nil)

		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"editor-dash.json"},
			},
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

		require.NoError(t, result.Error(), "editor should be able to create delete job")
		require.Equal(t, http.StatusAccepted, statusCode, "should return 202 Accepted")

		helper.AwaitJobs(t, repo)
	})

	t.Run("viewer cannot create delete job", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"dashboard.json"},
			},
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

		require.Error(t, result.Error(), "viewer should not be able to create delete job")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})

	t.Run("delete job blocked for folder resource in file", func(t *testing.T) {
		folderJSON := `{"apiVersion":"folder.grafana.app/v1","kind":"Folder","metadata":{"name":"sneaky-folder"},"spec":{"title":"Sneaky"}}`
		helper.WriteToProvisioningPath(t, "folder-as-file.json", []byte(folderJSON))

		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"folder-as-file.json"},
			},
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

		require.Error(t, result.Error(), "delete job should be blocked for folder resource in a file")
		require.NotEqual(t, http.StatusAccepted, statusCode, "should not return 202 Accepted")
	})

	t.Run("delete job blocked for unsupported resource type", func(t *testing.T) {
		unsupportedJSON := `{"apiVersion":"custom.example.io/v1","kind":"Widget","metadata":{"name":"test-widget"}}`
		helper.WriteToProvisioningPath(t, "unsupported-resource.json", []byte(unsupportedJSON))

		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"unsupported-resource.json"},
			},
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

		require.Error(t, result.Error(), "delete job should be blocked for unsupported resource type")
		require.NotEqual(t, http.StatusAccepted, statusCode, "should not return 202 Accepted")
	})
}
