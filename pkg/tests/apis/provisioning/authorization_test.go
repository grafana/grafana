package provisioning

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// TestIntegrationProvisioning_FilesAuthorization verifies that authorization
// works correctly for file operations with the access checker
func TestIntegrationProvisioning_FilesAuthorization(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	// Create a repository with a dashboard
	const repo = "authz-test-repo"
	helper.CreateRepo(t, TestRepo{
		Name:                   repo,
		Path:                   helper.ProvisioningPath,
		Target:                 "instance",
		SkipResourceAssertions: true, // We validate authorization, not resource creation
		Copies: map[string]string{
			"testdata/all-panels.json": "dashboard1.json",
		},
	})

	t.Run("GET file - Admin role should succeed", func(t *testing.T) {
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Do(ctx)

		require.NoError(t, result.Error(), "admin should be able to read files")

		var wrapper provisioning.ResourceWrapper
		require.NoError(t, result.Into(&wrapper))
		require.NotEmpty(t, wrapper.Resource.Upsert.Object, "should have resource data")
	})

	t.Run("GET file - Editor role should succeed", func(t *testing.T) {
		result := helper.EditorREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Do(ctx)

		require.NoError(t, result.Error(), "editor should be able to read files")

		var wrapper provisioning.ResourceWrapper
		require.NoError(t, result.Into(&wrapper))
		require.NotEmpty(t, wrapper.Resource.Upsert.Object, "should have resource data")
	})

	t.Run("GET file - Viewer role should succeed", func(t *testing.T) {
		result := helper.ViewerREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Do(ctx)

		require.NoError(t, result.Error(), "viewer should be able to read files")

		var wrapper provisioning.ResourceWrapper
		require.NoError(t, result.Into(&wrapper))
		require.NotEmpty(t, wrapper.Resource.Upsert.Object, "should have resource data")
	})

	t.Run("POST file (create) - Admin role should succeed", func(t *testing.T) {
		dashboardContent := helper.LoadFile("testdata/timeline-demo.json")

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "new-dashboard.json").
			Body(dashboardContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "admin should be able to create files")

		// Verify the dashboard was created
		var wrapper provisioning.ResourceWrapper
		require.NoError(t, result.Into(&wrapper))
		require.NotEmpty(t, wrapper.Resource.Upsert.Object, "should have created resource")
	})

	t.Run("POST file (create) - Editor role should succeed", func(t *testing.T) {
		dashboardContent := helper.LoadFile("testdata/text-options.json")

		result := helper.EditorREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "editor-dashboard.json").
			Body(dashboardContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "editor should be able to create files via access checker")

		// Verify the dashboard was created
		var wrapper provisioning.ResourceWrapper
		require.NoError(t, result.Into(&wrapper))
		require.NotEmpty(t, wrapper.Resource.Upsert.Object, "should have created resource")
	})

	t.Run("POST file (create) - Viewer role should fail", func(t *testing.T) {
		dashboardContent := helper.LoadFile("testdata/text-options.json")

		result := helper.ViewerREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "viewer-dashboard.json").
			Body(dashboardContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.Error(t, result.Error(), "viewer should not be able to create files")
		require.True(t, apierrors.IsForbidden(result.Error()), "should return Forbidden error")
	})

	t.Run("PUT file (update) - Admin role should succeed", func(t *testing.T) {
		// Read the dashboard first
		getDashboard := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Do(ctx)
		require.NoError(t, getDashboard.Error())

		var wrapper provisioning.ResourceWrapper
		require.NoError(t, getDashboard.Into(&wrapper))

		// Modify the dashboard title
		dashData, err := json.Marshal(wrapper.Resource.Upsert.Object)
		require.NoError(t, err)

		result := helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Body(dashData).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "admin should be able to update files")
	})

	t.Run("PUT file (update) - Editor role should succeed", func(t *testing.T) {
		// Read the dashboard first
		getDashboard := helper.EditorREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "new-dashboard.json").
			Do(ctx)
		require.NoError(t, getDashboard.Error())

		var wrapper provisioning.ResourceWrapper
		require.NoError(t, getDashboard.Into(&wrapper))

		// Modify the dashboard
		dashData, err := json.Marshal(wrapper.Resource.Upsert.Object)
		require.NoError(t, err)

		result := helper.EditorREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "new-dashboard.json").
			Body(dashData).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "editor should be able to update files via access checker")
	})

	t.Run("PUT file (update) - Viewer role should fail", func(t *testing.T) {
		// Try to update without reading first
		dashboardContent := helper.LoadFile("testdata/all-panels.json")

		result := helper.ViewerREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Body(dashboardContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.Error(t, result.Error(), "viewer should not be able to update files")
		require.True(t, apierrors.IsForbidden(result.Error()), "should return Forbidden error")
	})

	t.Run("DELETE file on branch - Editor role should succeed", func(t *testing.T) {
		// Create a test file
		dashboardContent := helper.LoadFile("testdata/timeline-demo.json")
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "to-delete.json").
			Body(dashboardContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error())

		// Delete on a branch (delete on configured branch is not allowed)
		result = helper.EditorREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "to-delete.json").
			Param("ref", "test-delete-branch").
			Do(ctx)

		require.NoError(t, result.Error(), "editor should be able to delete files on branches via access checker")
	})

	t.Run("DELETE file on branch - Viewer role should fail", func(t *testing.T) {
		result := helper.ViewerREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Param("ref", "test-delete-branch").
			Do(ctx)

		require.Error(t, result.Error(), "viewer should not be able to delete files")
		require.True(t, apierrors.IsForbidden(result.Error()), "should return Forbidden error")
	})
}
