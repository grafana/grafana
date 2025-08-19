package provisioning

import (
	"context"
	"encoding/json"
	"path"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestIntegrationHealth(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()
	repo := "test-repo-health"
	// Create first repository targeting "folder" with its own subdirectory
	helper.CreateRepo(t, TestRepo{
		Name:   repo,
		Path:   path.Join(helper.ProvisioningPath, repo),
		Target: "folder",
	})

	// Verify the health status before calling the endpoint
	repoObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
	require.NoError(t, err)
	originalRepo := unstructuredToRepository(t, repoObj)
	require.True(t, originalRepo.Status.Health.Healthy, "repository should be marked healthy")
	require.Empty(t, provisioning.HealthFailureHook, originalRepo.Status.Health.Error, "should be empty")
	require.Empty(t, originalRepo.Status.Health.Message, "should not have messages")

	t.Run("test endpoint with new repository configuration works", func(t *testing.T) {
		newRepoConfig := map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
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

		// Test the new configuration - this should work
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-new-config").
			SubResource("test").
			Body(configBytes).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "test endpoint should work for new repository configurations")

		obj, err := result.Get()
		require.NoError(t, err)

		testResults := parseTestResults(t, obj)
		require.True(t, testResults.Success, "test should succeed for valid repository configuration")
		require.Equal(t, 200, testResults.Code, "should return 200 for successful test")

		// Verify the repository was not actually created (this was just a test)
		_, err = helper.Repositories.Resource.Get(ctx, "test-new-config", metav1.GetOptions{})
		require.True(t, err != nil, "repository should not be created during test")
	})

	t.Run("test endpoint with existing repository", func(t *testing.T) {
		t.Skip("skip for now")
		repo := "test-existing-repo"

		// Test the existing repository - this currently causes API server panic
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("test").
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "test endpoint should return NOT an error for existing repository")
		obj, err := result.Get()
		require.NoError(t, err)
		testResults := parseTestResults(t, obj)
		t.Logf("SUCCESS: Test endpoint worked for existing repository: Success=%v, Code=%d",
			testResults.Success, testResults.Code)
		require.True(t, testResults.Success, "test should succeed for existing repository")
		require.Equal(t, 200, testResults.Code, "should return 200 for successful test")

		// Verify repository health status after update
		repoObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
		require.NoError(t, err)
		afterTest := unstructuredToRepository(t, repoObj)
		require.True(t, afterTest.Status.Health.Healthy, "repository should be marked healthy")
		require.Empty(t, provisioning.HealthFailureHook, afterTest.Status.Health.Error, "should be empty")
		require.Empty(t, afterTest.Status.Health.Message, "should not have messages")
		require.NotEqual(t, originalRepo.Status.Health.Checked, afterTest.Status.Health.Checked, "should change the timestamp")
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
