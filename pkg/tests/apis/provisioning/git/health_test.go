package git

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestIntegrationGitTestEndpoint_EmptyRepository(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	t.Run("test endpoint returns error for empty repository with no branch specified", func(t *testing.T) {
		remote, user := createEmptyGitRepo(t, helper, "test-empty-repo-no-branch")

		repoConfig := map[string]interface{}{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]interface{}{
				"name":      "test-empty-repo-no-branch",
				"namespace": "default",
			},
			"spec": map[string]interface{}{
				"title": "Test Empty Repository No Branch",
				"type":  "git",
				"git": map[string]interface{}{
					"url":       remote.URL,
					"branch":    "",
					"tokenUser": user.Username,
				},
				"sync": map[string]interface{}{
					"enabled":         false,
					"target":          "instance",
					"intervalSeconds": 60,
				},
			},
			"secure": map[string]interface{}{
				"token": map[string]interface{}{
					"create": user.Password,
				},
			},
		}

		configBytes, err := json.Marshal(repoConfig)
		require.NoError(t, err)

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-empty-repo-no-branch").
			SubResource("test").
			Body(configBytes).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "test endpoint should return a response, not an HTTP error")

		obj, err := result.Get()
		require.NoError(t, err)

		testResults := parseGitTestResults(t, obj)
		require.False(t, testResults.Success, "test should fail for empty repository")
		require.Equal(t, 400, testResults.Code, "should return 400 for empty repository")
		require.NotEmpty(t, testResults.Errors, "should have error details")
		require.Contains(t, testResults.Errors[0].Detail, "no branches",
			"error should mention the repository has no branches")
	})

	t.Run("test endpoint returns error for empty repository with branch specified", func(t *testing.T) {
		remote, user := createEmptyGitRepo(t, helper, "test-empty-repo-with-branch")

		repoConfig := map[string]interface{}{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]interface{}{
				"name":      "test-empty-repo-with-branch",
				"namespace": "default",
			},
			"spec": map[string]interface{}{
				"title": "Test Empty Repository With Branch",
				"type":  "git",
				"git": map[string]interface{}{
					"url":       remote.URL,
					"branch":    "main",
					"tokenUser": user.Username,
				},
				"sync": map[string]interface{}{
					"enabled":         false,
					"target":          "instance",
					"intervalSeconds": 60,
				},
			},
			"secure": map[string]interface{}{
				"token": map[string]interface{}{
					"create": user.Password,
				},
			},
		}

		configBytes, err := json.Marshal(repoConfig)
		require.NoError(t, err)

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-empty-repo-with-branch").
			SubResource("test").
			Body(configBytes).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "test endpoint should return a response, not an HTTP error")

		obj, err := result.Get()
		require.NoError(t, err)

		testResults := parseGitTestResults(t, obj)
		require.False(t, testResults.Success, "test should fail for empty repository")
		require.Equal(t, 400, testResults.Code, "should return 400 for empty repository")
		require.NotEmpty(t, testResults.Errors, "should have error details")
		require.Contains(t, testResults.Errors[0].Detail, "branch not found",
			"error should mention branch not found")
	})

	t.Run("test endpoint succeeds after pushing a commit to empty repository", func(t *testing.T) {
		remote, user := createEmptyGitRepo(t, helper, "test-empty-then-push")

		local, err := gittest.NewLocalRepo(ctx)
		require.NoError(t, err, "failed to create local repository")
		t.Cleanup(func() {
			if err := local.Cleanup(); err != nil {
				t.Logf("failed to cleanup local repo: %v", err)
			}
		})

		_, err = local.InitWithRemote(user, remote)
		require.NoError(t, err, "failed to initialize local repo with remote")

		repoConfig := map[string]interface{}{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]interface{}{
				"name":      "test-empty-then-push",
				"namespace": "default",
			},
			"spec": map[string]interface{}{
				"title": "Test Empty Then Push",
				"type":  "git",
				"git": map[string]interface{}{
					"url":       remote.URL,
					"branch":    "main",
					"tokenUser": user.Username,
				},
				"sync": map[string]interface{}{
					"enabled":         false,
					"target":          "instance",
					"intervalSeconds": 60,
				},
			},
			"secure": map[string]interface{}{
				"token": map[string]interface{}{
					"create": user.Password,
				},
			},
		}

		configBytes, err := json.Marshal(repoConfig)
		require.NoError(t, err)

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-empty-then-push").
			SubResource("test").
			Body(configBytes).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "test endpoint should return a response")

		obj, err := result.Get()
		require.NoError(t, err)

		testResults := parseGitTestResults(t, obj)
		require.True(t, testResults.Success, "test should succeed after pushing a commit")
		require.Equal(t, 200, testResults.Code, "should return 200 for successful test")
	})
}

// createEmptyGitRepo creates a git repository on the gittest server without any commits or branches.
func createEmptyGitRepo(t *testing.T, h *gitTestHelper, repoName string) (*gittest.RemoteRepository, *gittest.User) {
	t.Helper()

	ctx := context.Background()

	user, err := h.gitServer.CreateUser(ctx)
	require.NoError(t, err, "failed to create user")

	remote, err := h.gitServer.CreateRepo(ctx, repoName, user)
	require.NoError(t, err, fmt.Sprintf("failed to create remote repository %s", repoName))

	return remote, user
}

func parseGitTestResults(t *testing.T, obj runtime.Object) *provisioning.TestResults {
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
