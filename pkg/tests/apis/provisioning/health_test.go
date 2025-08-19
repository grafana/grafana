package provisioning

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestIntegrationHealth_RepositoryTest(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	// Cleanup before tests
	helper.CleanupAllRepos(t)

	t.Run("test endpoint does not panic", func(t *testing.T) {
		// The primary goal is to verify the API server doesn't panic when calling the test endpoint
		// Create a basic repository without syncing to avoid health complications
		repo := "test-no-panic-repo"
		localRepoConfig := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
			"Name":        repo,
			"SyncEnabled": false, // Disable sync to avoid health complications during CreateRepo
			"SyncTarget":  "folder",
		})

		_, err := helper.Repositories.Resource.Create(ctx, localRepoConfig, metav1.CreateOptions{})
		require.NoError(t, err, "should be able to create repository")

		// Test the repository health - main goal is no API server panic
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("test").
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		// The key assertion: API server should not panic
		if result.Error() != nil {
			t.Logf("Test endpoint returned error (might be expected): %v", result.Error())
			// This is the critical check - API server must not panic
			assert.False(t, strings.Contains(result.Error().Error(), "apiserver to panic"), 
				"API server should not panic when calling test endpoint")
		} else {
			// If no error, we can try to parse the results
			obj, err := result.Get()
			require.NoError(t, err)

			testResults := parseTestResults(t, obj)
			t.Logf("Test results: Success=%v, Code=%d, Errors=%v", 
				testResults.Success, testResults.Code, testResults.Errors)
		}

		// Clean up
		err = helper.Repositories.Resource.Delete(ctx, repo, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("test new repository configuration", func(t *testing.T) {
		// Test with a new repository configuration in the request body
		// This is a different code path that should work without creating a repository
		newRepoConfig := map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name": "test-new-config",
			},
			"spec": map[string]any{
				"title": "Test New Configuration",
				"type":  "local",
				"local": map[string]any{
					"path": helper.ProvisioningPath,
				},
				"workflows": []string{"write"},
				"sync": map[string]any{
					"enabled": true,
					"target":  "folder",
				},
			},
		}

		configBytes, err := json.Marshal(newRepoConfig)
		require.NoError(t, err)

		// Test the new configuration
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-new-config").
			SubResource("test").
			Body(configBytes).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		// Again, main goal is no API server panic
		if result.Error() != nil {
			t.Logf("Test endpoint returned error for new config (might be expected): %v", result.Error())
			// Critical check - no API server panic
			assert.False(t, strings.Contains(result.Error().Error(), "apiserver to panic"), 
				"API server should not panic when testing new configuration")
		} else {
			obj, err := result.Get()
			require.NoError(t, err)

			testResults := parseTestResults(t, obj)
			t.Logf("New config test results: Success=%v, Code=%d, Errors=%v", 
				testResults.Success, testResults.Code, testResults.Errors)
		}

		// Verify the repository was not actually created (this was just a test)
		_, err = helper.Repositories.Resource.Get(ctx, "test-new-config", metav1.GetOptions{})
		assert.True(t, err != nil, "repository should not be created during test")
	})

	// Final cleanup
	t.Cleanup(func() {
		helper.CleanupAllRepos(t)
	})
}

// parseTestResults extracts TestResults from the API response
func parseTestResults(t *testing.T, obj runtime.Object) *provisioning.TestResults {
	t.Helper()

	unstructuredObj, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expected unstructured object")

	data, err := json.Marshal(unstructuredObj.Object)
	require.NoError(t, err)

	var testResults provisioning.TestResults
	err = json.Unmarshal(data, &testResults)
	require.NoError(t, err)

	return &testResults
}