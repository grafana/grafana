package provisioning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/google/go-github/v82/github"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	githubConnection "github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationHealth(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	repo := "test-repo-health"
	helper.CreateRepo(t, TestRepo{
		Name:            repo,
		Target:          "folder",
		ExpectedFolders: 1,
	})

	// Verify the health status before calling the endpoint
	repoObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
	require.NoError(t, err)
	originalRepo := unstructuredToRepository(t, repoObj)
	require.True(t, originalRepo.Status.Health.Healthy, "repository should be marked healthy")
	require.Empty(t, originalRepo.Status.Health.Error, "should be empty")
	require.Empty(t, originalRepo.Status.Health.Message, "should not have messages")
	// When healthy, fieldErrors should be empty
	require.Empty(t, originalRepo.Status.FieldErrors, "fieldErrors should be empty when repository is healthy")
	// Verify Ready condition is set
	require.NotEmpty(t, originalRepo.Status.Conditions, "conditions should be set")
	readyCondition := findCondition(originalRepo.Status.Conditions, provisioning.ConditionTypeReady)
	require.NotNil(t, readyCondition, "Ready condition should exist")
	require.Equal(t, metav1.ConditionTrue, readyCondition.Status, "Ready condition should be True")
	require.Equal(t, provisioning.ReasonAvailable, readyCondition.Reason, "Ready condition should have Available reason")

	t.Run("test endpoint with new repository configuration works", func(t *testing.T) {
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

	t.Run("test endpoint with new repository with empty finaliers", func(t *testing.T) {
		newRepoConfig := map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			// No finalizers
			"metadata": map[string]any{},
			"spec": map[string]any{
				"title": "Test New Configuration with empty finalizers",
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
		// When healthy, fieldErrors should be empty
		require.Empty(t, afterTest.Status.FieldErrors, "fieldErrors should be empty when repository is healthy")
		// Verify Ready condition is set
		require.NotEmpty(t, afterTest.Status.Conditions, "conditions should be set")
		readyCondition := findCondition(afterTest.Status.Conditions, provisioning.ConditionTypeReady)
		require.NotNil(t, readyCondition, "Ready condition should exist")
		require.Equal(t, metav1.ConditionTrue, readyCondition.Status, "Ready condition should be True")
		require.Equal(t, provisioning.ReasonAvailable, readyCondition.Reason, "Ready condition should have Available reason")
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
		// When unhealthy, fieldErrors may be populated if there are validation errors
		// Note: fieldErrors are only populated from testResults, so they may not always be present for runtime errors

		// Recreate the repository directory to restore healthy state
		err = os.MkdirAll(repoPath, 0o750)
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
		// When healthy again, fieldErrors should be empty
		require.Empty(t, finalRepo.Status.FieldErrors, "fieldErrors should be empty when repository is healthy again")
		// Verify Ready condition is set
		require.NotEmpty(t, finalRepo.Status.Conditions, "conditions should be set")
		readyCondition := findCondition(finalRepo.Status.Conditions, provisioning.ConditionTypeReady)
		require.NotNil(t, readyCondition, "Ready condition should exist")
		require.Equal(t, metav1.ConditionTrue, readyCondition.Status, "Ready condition should be True")
		require.Equal(t, provisioning.ReasonAvailable, readyCondition.Reason, "Ready condition should have Available reason")

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

func TestIntegrationProvisioning_ConnectionTestEndpointWithPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	t.Run("dryRun call with App's insufficient permissions returns 403", func(t *testing.T) {
		// Setup mock with insufficient permissions
		connectionFactory := helper.GetEnv().GithubConnectionFactory.(*githubConnection.Factory)

		app := createAppWithPermissions(123456, map[string]string{
			"contents":      "read", // needs write
			"metadata":      "read",
			"pull_requests": "read", // needs write
			"webhooks":      "read", // needs write
		})
		installation := &github.Installation{
			ID: github.Ptr(int64(454545)),
		}

		connectionFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatchHandler(
				ghmock.GetApp,
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write(ghmock.MustMarshal(app))
				}),
			),
			ghmock.WithRequestMatchHandler(
				ghmock.GetAppInstallationsByInstallationId,
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write(ghmock.MustMarshal(installation))
				}),
			),
		)
		helper.SetGithubConnectionFactory(connectionFactory)

		// Create connection config for test
		config := &unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "provisioning.grafana.app/v0alpha1",
				"kind":       "Connection",
				"metadata": map[string]any{
					"name": "test",
				},
				"spec": map[string]any{
					"title": "Test Connection",
					"type":  "github",
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
			},
		}

		// Create with dryRun - that would test the connection
		c, err := helper.Connections.Resource.Create(ctx, config, metav1.CreateOptions{
			DryRun: []string{"All"},
		})
		require.Error(t, err)
		require.Nil(t, c)

		var k8sErr *k8serrors.StatusError
		require.True(t, errors.As(err, &k8sErr))

		require.Equal(t, metav1.StatusReasonInvalid, k8sErr.Status().Reason)
		require.NotNil(t, k8sErr.Status().Details)

		for _, reason := range k8sErr.Status().Details.Causes {
			require.Equal(t, metav1.CauseTypeFieldValueInvalid, reason.Type)
			require.Equal(t, "spec.github.appID", reason.Field)

			switch {
			case strings.Contains(reason.Message, "pull_requests"):
				require.Contains(t, reason.Message, "requires 'write', has 'read'")
			case strings.Contains(reason.Message, "webhooks"):
				require.Contains(t, reason.Message, "requires 'write', has 'read'")
			case strings.Contains(reason.Message, "contents"):
				require.Contains(t, reason.Message, "requires 'write', has 'read'")
			case strings.Contains(reason.Message, "metadata"):
				t.Fatalf("should not error on metadata")
			}
		}
	})

	t.Run("dryRun call with App Installation's insufficient permissions returns 403", func(t *testing.T) {
		// Setup mock with insufficient permissions
		connectionFactory := helper.GetEnv().GithubConnectionFactory.(*githubConnection.Factory)

		app := createAppWithPermissions(123456, map[string]string{
			// App has all permissions
			"contents":      "write",
			"metadata":      "read",
			"pull_requests": "write",
			"webhooks":      "write",
		})
		installation := createAppInstallationWithPermissions(454545, map[string]string{
			"contents":      "read", // needs write
			"metadata":      "read",
			"pull_requests": "read", // needs write
			"webhooks":      "read", // needs write
		})

		connectionFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatchHandler(
				ghmock.GetApp,
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write(ghmock.MustMarshal(app))
				}),
			),
			ghmock.WithRequestMatchHandler(
				ghmock.GetAppInstallationsByInstallationId,
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write(ghmock.MustMarshal(installation))
				}),
			),
		)
		helper.SetGithubConnectionFactory(connectionFactory)

		// Create connection config for test
		config := &unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "provisioning.grafana.app/v0alpha1",
				"kind":       "Connection",
				"metadata": map[string]any{
					"name": "test",
				},
				"spec": map[string]any{
					"title": "Test Connection",
					"type":  "github",
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
			},
		}

		// Create with dryRun - that would test the connection
		c, err := helper.Connections.Resource.Create(ctx, config, metav1.CreateOptions{
			DryRun: []string{"All"},
		})
		require.Error(t, err)
		require.Nil(t, c)

		var k8sErr *k8serrors.StatusError
		require.True(t, errors.As(err, &k8sErr))

		require.Equal(t, metav1.StatusReasonInvalid, k8sErr.Status().Reason)
		require.NotNil(t, k8sErr.Status().Details)

		for _, reason := range k8sErr.Status().Details.Causes {
			require.Equal(t, metav1.CauseTypeFieldValueInvalid, reason.Type)
			require.Equal(t, "spec.github.installationID", reason.Field)

			switch {
			case strings.Contains(reason.Message, "pull_requests"):
				require.Contains(t, reason.Message, "requires 'write', has 'read'")
			case strings.Contains(reason.Message, "webhooks"):
				require.Contains(t, reason.Message, "requires 'write', has 'read'")
			case strings.Contains(reason.Message, "contents"):
				require.Contains(t, reason.Message, "requires 'write', has 'read'")
			case strings.Contains(reason.Message, "metadata"):
				t.Fatalf("should not error on metadata")
			}
		}
	})

	t.Run("dryRun call with App's and Installation's all permissions succeeds", func(t *testing.T) {
		// Setup mock with all required permissions
		connectionFactory := helper.GetEnv().GithubConnectionFactory.(*githubConnection.Factory)

		app := createAppWithPermissions(123456, map[string]string{
			"contents":      "write",
			"metadata":      "read",
			"pull_requests": "write",
			"webhooks":      "write",
		})
		installation := &github.Installation{
			ID: github.Ptr(int64(454545)),
			Permissions: &github.InstallationPermissions{
				Contents:        github.Ptr("write"),
				Metadata:        github.Ptr("read"),
				PullRequests:    github.Ptr("write"),
				RepositoryHooks: github.Ptr("write"),
			},
		}

		connectionFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatchHandler(
				ghmock.GetApp,
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write(ghmock.MustMarshal(app))
				}),
			),
			ghmock.WithRequestMatchHandler(
				ghmock.GetAppInstallationsByInstallationId,
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write(ghmock.MustMarshal(installation))
				}),
			),
		)
		helper.SetGithubConnectionFactory(connectionFactory)

		config := &unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "provisioning.grafana.app/v0alpha1",
				"kind":       "Connection",
				"metadata": map[string]any{
					"name": "test",
				},
				"spec": map[string]any{
					"title": "Test Connection",
					"type":  "github",
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
			},
		}

		// Create with dryRun - that would test the connection
		c, err := helper.Connections.Resource.Create(ctx, config, metav1.CreateOptions{
			DryRun: []string{"All"},
		})
		require.NoError(t, err)
		require.NotNil(t, c)
	})
}
