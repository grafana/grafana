package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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

// TestIntegrationProvisioning_FilesAuthorizationConfiguredBranch tests that
// single file/folder operations are blocked on the configured branch
func TestIntegrationProvisioning_FilesAuthorizationConfiguredBranch(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	// Create a repository with a dashboard
	const repo = "configured-branch-test"
	helper.CreateRepo(t, TestRepo{
		Name:                   repo,
		Path:                   helper.ProvisioningPath,
		Target:                 "instance",
		SkipResourceAssertions: true, // We validate authorization, not resource creation
		Copies: map[string]string{
			"testdata/all-panels.json": "dashboard1.json",
		},
	})

	t.Run("DELETE file on configured branch - should return MethodNotAllowed", func(t *testing.T) {
		// Note: Using raw HTTP request because k8s client doesn't support empty ref
		addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
		url := "http://admin:admin@" + addr + "/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/" + repo + "/files/dashboard1.json"

		req, err := http.NewRequest(http.MethodDelete, url, nil)
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusMethodNotAllowed, resp.StatusCode,
			"delete on configured branch should return MethodNotAllowed")
	})

	t.Run("MOVE file on configured branch - should return MethodNotAllowed", func(t *testing.T) {
		addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
		url := "http://admin:admin@" + addr + "/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/" + repo + "/files/moved.json?originalPath=dashboard1.json"

		dashboardContent := helper.LoadFile("testdata/all-panels.json")
		req, err := http.NewRequest(http.MethodPost, url, http.NoBody)
		require.NoError(t, err)
		req.Body = http.NoBody
		req.ContentLength = int64(len(dashboardContent))

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusMethodNotAllowed, resp.StatusCode,
			"move on configured branch should return MethodNotAllowed")
	})

	t.Run("DELETE file on branch - should check authorization first", func(t *testing.T) {
		// Even though delete is allowed on branches, authorization should be checked first
		result := helper.ViewerREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Param("ref", "test-branch").
			Do(ctx)

		require.Error(t, result.Error(), "should check authorization before branch validation")
		require.True(t, apierrors.IsForbidden(result.Error()), "should return Forbidden (not MethodNotAllowed)")
	})
}

// TestIntegrationProvisioning_ProvisioningServiceIdentity verifies that the
// provisioning service itself (operating with service identity) has full access
func TestIntegrationProvisioning_ProvisioningServiceIdentity(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	// Create a repository
	const repo = "service-identity-test"
	helper.CreateRepo(t, TestRepo{
		Name:   repo,
		Path:   helper.ProvisioningPath,
		Target: "instance",
		Copies: map[string]string{
			"testdata/all-panels.json": "dashboard1.json",
		},
		// Don't skip assertions here - we want to verify sync worked
	})

	// Verify that sync succeeded - this proves service identity has full access
	dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, dashboards.Items, 1, "sync via service identity should have created dashboard")

	t.Run("Service identity can create resources", func(t *testing.T) {
		// Copy another file and sync
		helper.CopyToProvisioningPath(t, "testdata/timeline-demo.json", "dashboard2.json")
		helper.SyncAndWait(t, repo, nil)

		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, dashboards.Items, 2, "service identity should be able to create resources")
	})

	t.Run("Service identity can update resources", func(t *testing.T) {
		// Modify existing file and sync
		helper.CopyToProvisioningPath(t, "testdata/all-panels.json", "dashboard1.json")
		helper.SyncAndWait(t, repo, nil)

		// Verify update succeeded
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, dashboards.Items, 2, "service identity should be able to update resources")
	})
}
