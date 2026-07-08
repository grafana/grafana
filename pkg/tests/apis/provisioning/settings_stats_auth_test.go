package provisioning

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestIntegrationProvisioning_SettingsAuthorization(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	t.Run("viewer can GET settings", func(t *testing.T) {
		var statusCode int
		result := helper.ViewerREST.Get().
			Namespace("default").
			Resource("settings").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "viewer should be able to GET settings")
		require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
	})

	t.Run("editor can GET settings", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Get().
			Namespace("default").
			Resource("settings").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "editor should be able to GET settings")
		require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
	})

	t.Run("admin can GET settings", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("settings").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "admin should be able to GET settings")
		require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
	})

	t.Run("settings endpoint returns MaxRepositories field with default value", func(t *testing.T) {
		// HACK: Explicitly set to 10 to test default behavior, since we can't distinguish "not set" from "set to 0"
		helper := sharedHelper(t)
		helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 10}) // Explicitly set to default to test default behavior
		ctx := context.Background()

		settings := &provisioning.RepositoryViewList{}
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("settings").
			Do(ctx)

		require.NoError(t, result.Error(), "should be able to GET settings")
		err := result.Into(settings)
		require.NoError(t, err, "should be able to unmarshal settings response")
		require.NotNil(t, settings, "settings should not be nil")
		// Default should be 10 when set to 10 (or when not configured, but we can't test that due to HACK)
		require.Equal(t, int64(10), settings.MaxRepositories, "MaxRepositories should be 10 when set to default")
	})

	t.Run("settings endpoint returns 0 when unlimited is configured", func(t *testing.T) {
		helper := sharedHelper(t)
		helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 0}) // 0 means unlimited
		ctx := context.Background()

		settings := &provisioning.RepositoryViewList{}
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("settings").
			Do(ctx)

		require.NoError(t, result.Error(), "should be able to GET settings")
		err := result.Into(settings)
		require.NoError(t, err, "should be able to unmarshal settings response")
		require.NotNil(t, settings, "settings should not be nil")
		// Should return 0 when unlimited is configured
		require.Equal(t, int64(0), settings.MaxRepositories, "MaxRepositories should be 0 when unlimited")
	})

	t.Run("settings endpoint returns configured value", func(t *testing.T) {
		helper := sharedHelper(t)
		helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 1000})
		ctx := context.Background()

		settings := &provisioning.RepositoryViewList{}
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("settings").
			Do(ctx)

		require.NoError(t, result.Error(), "should be able to GET settings")
		err := result.Into(settings)
		require.NoError(t, err, "should be able to unmarshal settings response")
		require.NotNil(t, settings, "settings should not be nil")
		// Should return the configured value
		require.Equal(t, int64(1000), settings.MaxRepositories, "MaxRepositories should be 1000 when configured")
	})

	t.Run("settings endpoint surfaces the default supported resources, enabled and disabled", func(t *testing.T) {
		settings := &provisioning.RepositoryViewList{}
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("settings").
			Do(ctx)

		require.NoError(t, result.Error(), "should be able to GET settings")
		require.NoError(t, result.Into(settings), "should be able to unmarshal settings response")

		// The default config (conf/defaults.ini) declares folders + dashboards (active) and
		// library panels + playlists (disabled). All are surfaced; disabled ones carry the flag.
		require.ElementsMatch(t, []provisioning.SupportedResource{
			{Group: "folder.grafana.app", Kind: "Folder"},
			{Group: "dashboard.grafana.app", Kind: "Dashboard"},
			{Group: "dashboard.grafana.app", Kind: "LibraryPanel", Disabled: true},
			{Group: "playlist.grafana.app", Kind: "Playlist", Disabled: true},
		}, settings.AvailableResources, "settings should surface the default supported resources")
	})
}

// TestIntegrationProvisioning_SettingsExtraResources verifies that a resource added purely
// through configuration (the [provisioning] resources token list) is surfaced on the
// settings endpoint, i.e. adding a provisionable resource is a config change.
func TestIntegrationProvisioning_SettingsExtraResources(t *testing.T) {
	helper := common.RunGrafana(t, func(opts *testinfra.GrafanaOpts) {
		// Overrides the defaults. The kind need not be served: the settings endpoint surfaces
		// the configured descriptor without discovery.
		opts.ProvisioningResources = []string{
			"folder.grafana.app/Folder:folder",
			"dashboard.grafana.app/Dashboard:folder",
			"example.grafana.app/Example",
		}
	})
	ctx := context.Background()

	settings := &provisioning.RepositoryViewList{}
	result := helper.AdminREST.Get().
		Namespace("default").
		Resource("settings").
		Do(ctx)

	require.NoError(t, result.Error(), "should be able to GET settings")
	require.NoError(t, result.Into(settings), "should be able to unmarshal settings response")

	require.Contains(t, settings.AvailableResources, provisioning.SupportedResource{
		Group: "example.grafana.app", Kind: "Example",
	}, "a resource added through config should be surfaced on the settings endpoint")
}

func TestIntegrationProvisioning_StatsAuthorization(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	// Create a repository to ensure stats endpoint has data
	const repo = "stats-auth-test"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:               repo,
		SyncTarget:         "folder",
		Copies:             map[string]string{},
		ExpectedDashboards: 0,
		ExpectedFolders:    1,
	})

	t.Run("admin can GET stats", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("stats").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "admin should be able to GET stats")
		require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
	})

	t.Run("editor cannot GET stats", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Get().
			Namespace("default").
			Resource("stats").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "editor should not be able to GET stats")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})

	t.Run("viewer cannot GET stats", func(t *testing.T) {
		var statusCode int
		result := helper.ViewerREST.Get().
			Namespace("default").
			Resource("stats").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "viewer should not be able to GET stats")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})
}
