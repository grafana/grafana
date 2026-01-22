package provisioning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_ConnectionRepositories(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	// Create a connection for testing
	connection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      "connection-repositories-test",
			"namespace": "default",
		},
		"spec": map[string]any{
			"type": "github",
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "454545",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": privateKeyBase64,
			},
		},
	}}
	_, err := helper.CreateGithubConnection(t, ctx, connection)
	require.NoError(t, err)

	t.Run("admin can access endpoint and get repository list", func(t *testing.T) {
		var statusCode int
		var resultList provisioning.ExternalRepositoryList
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("connections").
			Name("connection-repositories-test").
			SubResource("repositories").
			Do(ctx).
			StatusCode(&statusCode)

		// Endpoint is implemented and should return 200 with repository list
		err := result.Error()
		require.NoError(t, err, "endpoint should succeed")
		err = result.Into(&resultList)
		require.NoError(t, err, "should parse response")
		require.Equal(t, http.StatusOK, statusCode)

		// Verify the repository list contains expected repositories
		require.NotNil(t, resultList.Items)
		require.Len(t, resultList.Items, 3, "should return 3 repositories")

		// Verify each repository has the expected structure
		expectedRepos := []provisioning.ExternalRepository{
			{Name: "test-repo-1", Owner: "test-owner-1", URL: "https://github.com/test-owner-1/test-repo-1"},
			{Name: "test-repo-2", Owner: "test-owner-2", URL: "https://github.com/test-owner-2/test-repo-2"},
			{Name: "test-repo-3", Owner: "test-owner-3", URL: "https://github.com/test-owner-3/test-repo-3"},
		}

		for i, expectedRepo := range expectedRepos {
			require.Equal(t, expectedRepo.Name, resultList.Items[i].Name, "repository %d name should match", i)
			require.Equal(t, expectedRepo.Owner, resultList.Items[i].Owner, "repository %d owner should match", i)
			require.Equal(t, expectedRepo.URL, resultList.Items[i].URL, "repository %d URL should match", i)
		}
	})

	t.Run("editor cannot access endpoint", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Get().
			Namespace("default").
			Resource("connections").
			Name("connection-repositories-test").
			SubResource("repositories").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "editor should not be able to access repositories endpoint")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})

	t.Run("viewer cannot access endpoint", func(t *testing.T) {
		var statusCode int
		result := helper.ViewerREST.Get().
			Namespace("default").
			Resource("connections").
			Name("connection-repositories-test").
			SubResource("repositories").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "viewer should not be able to access repositories endpoint")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})

	t.Run("non-GET methods are rejected", func(t *testing.T) {
		configBytes, _ := json.Marshal(map[string]any{})

		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("connections").
			Name("connection-repositories-test").
			SubResource("repositories").
			Body(configBytes).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "POST should not be allowed")
		require.True(t, apierrors.IsMethodNotSupported(result.Error()), "error should be MethodNotSupported")
	})
}

func TestIntegrationProvisioning_ConnectionRepositoriesResponseType(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	// Create a connection for testing
	connection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      "connection-repositories-test",
			"namespace": "default",
		},
		"spec": map[string]any{
			"type": "github",
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "454545",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": privateKeyBase64,
			},
		},
	}}
	_, err := helper.CreateGithubConnection(t, ctx, connection)
	require.NoError(t, err)

	t.Run("verify ExternalRepositoryList type exists in API", func(t *testing.T) {
		// Verify the type is registered and can be instantiated
		list := &provisioning.ExternalRepositoryList{}
		require.NotNil(t, list)
		// Verify it has the expected structure (Items is a slice, nil by default is fine)
		require.IsType(t, []provisioning.ExternalRepository{}, list.Items)
		// Can create items
		list.Items = []provisioning.ExternalRepository{
			{Name: "test", Owner: "owner", URL: "https://example.com/repo"},
		}
		require.Len(t, list.Items, 1)
		require.Equal(t, "test", list.Items[0].Name)
	})
}
