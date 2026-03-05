package provisioning

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_JobResourceAuthorization(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "job-resource-auth-test"
	testRepo := TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json":   "team-a/dashboard1.json",
			"testdata/text-options.json": "team-b/dashboard2.json",
		},
		ExpectedDashboards: 2,
		ExpectedFolders:    3, // root + team-a + team-b
	}
	helper.CreateRepo(t, testRepo)

	t.Run("admin can create delete job for any folder path", func(t *testing.T) {
		body := asJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"team-a/dashboard1.json"},
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
		require.Equal(t, http.StatusAccepted, statusCode)

		helper.AwaitJobs(t, repo)

		// Re-add the dashboard for subsequent tests
		helper.CopyToProvisioningPath(t, "testdata/all-panels.json", "team-a/dashboard1.json")
		helper.SyncAndWait(t, repo, nil)
	})

	t.Run("editor can create delete job with default permissions", func(t *testing.T) {
		// Grant editor broad dashboard permissions
		helper.SetPermissions(helper.Org1.Editor, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{"dashboards:read", "dashboards:write", "dashboards:delete", "dashboards:create"},
				Resource:          "dashboards",
				ResourceAttribute: "uid",
				ResourceID:        "*",
			},
			{
				Actions:           []string{"folders:read", "folders:write", "folders:delete", "folders:create"},
				Resource:          "folders",
				ResourceAttribute: "uid",
				ResourceID:        "*",
			},
		})

		body := asJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"team-b/dashboard2.json"},
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

		require.NoError(t, result.Error(), "editor with broad permissions should be able to create delete job")
		require.Equal(t, http.StatusAccepted, statusCode)

		helper.AwaitJobs(t, repo)

		// Re-add the dashboard for subsequent tests
		helper.CopyToProvisioningPath(t, "testdata/text-options.json", "team-b/dashboard2.json")
		helper.SyncAndWait(t, repo, nil)
	})

	t.Run("viewer cannot create delete job", func(t *testing.T) {
		body := asJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"team-a/dashboard1.json"},
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
		require.Equal(t, http.StatusForbidden, statusCode)
		require.True(t, apierrors.IsForbidden(result.Error()))
	})

	t.Run("admin can create move job", func(t *testing.T) {
		body := asJSON(provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"team-a/dashboard1.json"},
				TargetPath: "team-b/",
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

		require.NoError(t, result.Error(), "admin should be able to create move job")
		require.Equal(t, http.StatusAccepted, statusCode)

		helper.AwaitJobs(t, repo)
	})

	t.Run("editor can create move job with permissions", func(t *testing.T) {
		// Sync to get a consistent state after the admin move
		helper.SyncAndWait(t, repo, nil)

		// Verify we have dashboards to work with
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(dashboards.Items), 1, "should have at least 1 dashboard")

		// Grant editor broad permissions
		helper.SetPermissions(helper.Org1.Editor, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{"dashboards:read", "dashboards:write", "dashboards:delete", "dashboards:create"},
				Resource:          "dashboards",
				ResourceAttribute: "uid",
				ResourceID:        "*",
			},
			{
				Actions:           []string{"folders:read", "folders:write", "folders:delete", "folders:create"},
				Resource:          "folders",
				ResourceAttribute: "uid",
				ResourceID:        "*",
			},
		})

		body := asJSON(provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"team-b/"},
				TargetPath: "archived/",
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

		require.NoError(t, result.Error(), "editor with permissions should be able to create move job")
		require.Equal(t, http.StatusAccepted, statusCode)

		helper.AwaitJobs(t, repo)
	})

	t.Run("editor without folder delete permission is rejected", func(t *testing.T) {
		// Set editor permissions to only have read access -- no delete
		helper.SetPermissions(helper.Org1.Editor, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{"dashboards:read"},
				Resource:          "dashboards",
				ResourceAttribute: "uid",
				ResourceID:        "*",
			},
			{
				Actions:           []string{"folders:read"},
				Resource:          "folders",
				ResourceAttribute: "uid",
				ResourceID:        "*",
			},
		})

		body := asJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"archived/"},
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

		require.Error(t, result.Error(), "editor without delete permission should be rejected")
		assert.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden, got: %v", result.Error())
	})
}
