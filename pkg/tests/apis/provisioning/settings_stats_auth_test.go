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

func TestIntegrationProvisioning_SettingsAuthorization(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
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

	t.Run("settings endpoint returns MaxRepositories field", func(t *testing.T) {
		settings := &provisioning.RepositoryViewList{}
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("settings").
			Do(ctx)

		require.NoError(t, result.Error(), "should be able to GET settings")
		err := result.Into(settings)
		require.NoError(t, err, "should be able to unmarshal settings response")
		// MaxRepositories should be present (default is 0 = unlimited)
		require.NotNil(t, settings, "settings should not be nil")
		// The field should exist and default to 0 (unlimited) when not configured
		require.Equal(t, int64(0), settings.MaxRepositories, "MaxRepositories should default to 0 (unlimited)")
	})
}

func TestIntegrationProvisioning_StatsAuthorization(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	// Create a repository to ensure stats endpoint has data
	const repo = "stats-auth-test"
	helper.CreateRepo(t, TestRepo{
		Name:               repo,
		Target:             "folder",
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
