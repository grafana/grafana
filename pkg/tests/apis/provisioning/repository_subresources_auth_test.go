package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_RepositorySubresourcesAuthorization(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "subresources-auth-test"
	testRepo := TestRepo{
		Name:               repo,
		Target:             "folder",
		Copies:             map[string]string{}, // No files needed for this test
		ExpectedDashboards: 0,
		ExpectedFolders:    1, // Repository creates a folder
	}
	helper.CreateRepo(t, testRepo)

	t.Run("test subresource", func(t *testing.T) {
		newRepoConfig := map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"finalizers": []string{
					"remove-orphan-resources",
					"cleanup",
				},
			},
			"spec": map[string]any{
				"title": "Test Configuration",
				"type":  "local",
				"local": map[string]any{
					"path": helper.ProvisioningPath,
				},
				"workflows": []string{"write"},
				"sync": map[string]any{
					"enabled":         true,
					"target":          "folder",
					"intervalSeconds": 10,
				},
			},
		}
		configBytes, err := json.Marshal(newRepoConfig)
		require.NoError(t, err)

		t.Run("admin can POST test", func(t *testing.T) {
			var statusCode int
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name("test-config-auth").
				SubResource("test").
				Body(configBytes).
				SetHeader("Content-Type", "application/json").
				Do(ctx).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "admin should be able to POST test")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
		})

		t.Run("editor cannot POST test", func(t *testing.T) {
			var statusCode int
			result := helper.EditorREST.Post().
				Namespace("default").
				Resource("repositories").
				Name("test-config-auth").
				SubResource("test").
				Body(configBytes).
				SetHeader("Content-Type", "application/json").
				Do(ctx).StatusCode(&statusCode)

			require.Error(t, result.Error(), "editor should not be able to POST test")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})

		t.Run("viewer cannot POST test", func(t *testing.T) {
			var statusCode int
			result := helper.ViewerREST.Post().
				Namespace("default").
				Resource("repositories").
				Name("test-config-auth").
				SubResource("test").
				Body(configBytes).
				SetHeader("Content-Type", "application/json").
				Do(ctx).StatusCode(&statusCode)

			require.Error(t, result.Error(), "viewer should not be able to POST test")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})
	})

	t.Run("resources subresource", func(t *testing.T) {
		t.Run("admin can GET resources", func(t *testing.T) {
			var statusCode int
			result := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("resources").
				Do(ctx).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "admin should be able to GET resources")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
		})

		t.Run("editor cannot GET resources", func(t *testing.T) {
			var statusCode int
			result := helper.EditorREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("resources").
				Do(ctx).StatusCode(&statusCode)

			require.Error(t, result.Error(), "editor should not be able to GET resources")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})

		t.Run("viewer cannot GET resources", func(t *testing.T) {
			var statusCode int
			result := helper.ViewerREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("resources").
				Do(ctx).StatusCode(&statusCode)

			require.Error(t, result.Error(), "viewer should not be able to GET resources")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})
	})

	t.Run("history subresource", func(t *testing.T) {
		t.Run("admin can GET history (or BadRequest if not supported)", func(t *testing.T) {
			var statusCode int
			result := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("history").
				Do(ctx).StatusCode(&statusCode)

			// Admin should pass authorization - may get BadRequest if repo doesn't support history
			// but should NOT get Forbidden (which would indicate authorization failure)
			if result.Error() != nil {
				require.False(t, apierrors.IsForbidden(result.Error()), "admin should not get Forbidden error")
				// Local repos don't support history, so BadRequest is expected
				require.True(t, apierrors.IsBadRequest(result.Error()) || statusCode == http.StatusBadRequest,
					"should get BadRequest if history not supported, not Forbidden")
			} else {
				require.Equal(t, http.StatusOK, statusCode, "should return 200 OK if history is supported")
			}
		})

		t.Run("editor cannot GET history", func(t *testing.T) {
			var statusCode int
			result := helper.EditorREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("history").
				Do(ctx).StatusCode(&statusCode)

			require.Error(t, result.Error(), "editor should not be able to GET history")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})

		t.Run("viewer cannot GET history", func(t *testing.T) {
			var statusCode int
			result := helper.ViewerREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("history").
				Do(ctx).StatusCode(&statusCode)

			require.Error(t, result.Error(), "viewer should not be able to GET history")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})
	})

	t.Run("status subresource", func(t *testing.T) {
		t.Run("admin can GET status", func(t *testing.T) {
			var statusCode int
			result := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("status").
				Do(ctx).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "admin should be able to GET status")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
		})

		t.Run("editor cannot GET status", func(t *testing.T) {
			var statusCode int
			result := helper.EditorREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("status").
				Do(ctx).StatusCode(&statusCode)

			require.Error(t, result.Error(), "editor should not be able to GET status")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})

		t.Run("viewer cannot GET status", func(t *testing.T) {
			var statusCode int
			result := helper.ViewerREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("status").
				Do(ctx).StatusCode(&statusCode)

			require.Error(t, result.Error(), "viewer should not be able to GET status")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})
	})
}
