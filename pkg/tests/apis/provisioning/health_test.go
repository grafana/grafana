package provisioning

import (
	"context"
	"encoding/json"
	"os"
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
	helper.CreateRepo(t, TestRepo{
		Name: repo,
	})

	// Verify the health status before calling the endpoint
	repoObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
	require.NoError(t, err)
	originalRepo := unstructuredToRepository(t, repoObj)
	require.True(t, originalRepo.Status.Health.Healthy, "repository should be marked healthy")
	require.Empty(t, originalRepo.Status.Health.Error, "should be empty")
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
					"enabled":         true,
					"target":          "folder",
					"intervalSeconds": 10,
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
		require.Empty(t, afterTest.Status.Health.Error, "should be empty")
		require.Empty(t, afterTest.Status.Health.Message, "should not have messages")
		// For healthy repositories, timestamp may not change immediately as it can take up to 30 seconds to update
	})

	t.Run("test endpoint with unhealthy repository", func(t *testing.T) {
		// Remove the repository folder to make it unhealthy
		repoPath := helper.ProvisioningPath
		err := os.RemoveAll(repoPath)
		require.NoError(t, err, "should be able to remove repository directory")

		// Wait a bit for the system to detect the unhealthy state
		// (In a real scenario, this would be detected during the next health check cycle)

		// Get the repository status before the test
		repoObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
		require.NoError(t, err)
		beforeTest := unstructuredToRepository(t, repoObj)
		t.Logf("Before test - Healthy: %v, Checked: %d", beforeTest.Status.Health.Healthy, beforeTest.Status.Health.Checked)

		// Call the test endpoint
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("test").
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		// The test endpoint may return an error for unhealthy repositories
		obj, err := result.Get()
		if result.Error() != nil {
			t.Logf("Test endpoint returned error for unhealthy repository (expected): %v", result.Error())
		} else {
			require.NoError(t, err)
			testResults := parseTestResults(t, obj)
			t.Logf("Test endpoint result for unhealthy repository: Success=%v, Code=%d",
				testResults.Success, testResults.Code)
		}

		// Verify repository health status after test - timestamp should change
		repoObj, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
		require.NoError(t, err)
		afterTest := unstructuredToRepository(t, repoObj)
		t.Logf("After test - Healthy: %v, Checked: %d", afterTest.Status.Health.Healthy, afterTest.Status.Health.Checked)

		// For unhealthy repositories, the timestamp should change as the health check will be triggered
		require.NotEqual(t, beforeTest.Status.Health.Checked, afterTest.Status.Health.Checked, "should change the timestamp for unhealthy repository check")

		// Recreate the repository directory to restore healthy state
		err = os.MkdirAll(repoPath, 0o755)
		require.NoError(t, err, "should be able to recreate repository directory")

		// Call the test endpoint again to trigger health check after recreating directory
		result = helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("test").
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		// Should succeed now that the directory is recreated
		require.NoError(t, result.Error(), "test endpoint should work after recreating directory")
		obj, err = result.Get()
		require.NoError(t, err)
		testResults := parseTestResults(t, obj)
		require.True(t, testResults.Success, "test should succeed after recreating directory")
		require.Equal(t, 200, testResults.Code, "should return 200 after recreating directory")

		// Verify repository health status is now healthy again
		repoObj, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
		require.NoError(t, err)
		finalRepo := unstructuredToRepository(t, repoObj)
		t.Logf("After recreating directory - Healthy: %v, Checked: %d", finalRepo.Status.Health.Healthy, finalRepo.Status.Health.Checked)
		require.True(t, finalRepo.Status.Health.Healthy, "repository should be healthy again after recreating directory")
		require.Empty(t, finalRepo.Status.Health.Error, "should have no error after recreating directory")

		// Timestamp should have changed again due to the health check
		require.NotEqual(t, afterTest.Status.Health.Checked, finalRepo.Status.Health.Checked, "timestamp should change when repository becomes healthy again")
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
