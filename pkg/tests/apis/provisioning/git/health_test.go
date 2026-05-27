package git

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/require"
)

func TestIntegrationGitTestEndpoint_EmptyRepository(t *testing.T) {
	helper := sharedGitHelper(t)

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

		testResults := callTestEndpoint(t, helper, "test-empty-repo-no-branch", repoConfig, http.StatusBadRequest)
		require.False(t, testResults.Success, "test should fail for empty repository")
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

		testResults := callTestEndpoint(t, helper, "test-empty-repo-with-branch", repoConfig, http.StatusBadRequest)
		require.False(t, testResults.Success, "test should fail for empty repository")
		require.NotEmpty(t, testResults.Errors, "should have error details")
		require.Contains(t, testResults.Errors[0].Detail, "no branches",
			"error should mention the repository has no branches")
	})

	t.Run("test endpoint succeeds after pushing a commit to empty repository", func(t *testing.T) {
		ctx := context.Background()
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

		testResults := callTestEndpoint(t, helper, "test-empty-then-push", repoConfig, http.StatusOK)
		require.True(t, testResults.Success, "test should succeed after pushing a commit")
	})
}

// callTestEndpoint calls the /test subresource using raw HTTP and parses the TestResults.
// This is needed because the test endpoint returns TestResults with non-2xx status codes
// for failures, and the k8s REST client treats non-2xx as errors, losing the response body.
func callTestEndpoint(t *testing.T, h *common.GitTestHelper, repoName string, repoConfig map[string]interface{}, expectedStatus int) *provisioning.TestResults {
	t.Helper()

	configBytes, err := json.Marshal(repoConfig)
	require.NoError(t, err)

	addr := h.GetEnv().Server.HTTPServer.Listener.Addr().String()
	url := fmt.Sprintf(
		"http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/test",
		addr, repoName,
	)

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(configBytes))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()

	require.Equal(t, expectedStatus, resp.StatusCode,
		"test endpoint should return expected HTTP status for repo %s", repoName)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	var testResults provisioning.TestResults
	err = json.Unmarshal(body, &testResults)
	require.NoError(t, err, "response body should be valid TestResults JSON")

	return &testResults
}

// createEmptyGitRepo creates a git repository on the gittest server without any commits or branches.
func createEmptyGitRepo(t *testing.T, h *common.GitTestHelper, repoName string) (*gittest.RemoteRepository, *gittest.User) {
	t.Helper()

	ctx := context.Background()

	user, err := h.GitServer().CreateUser(ctx)
	require.NoError(t, err, "failed to create user")

	remote, err := h.GitServer().CreateRepo(ctx, repoName, user)
	require.NoError(t, err, fmt.Sprintf("failed to create remote repository %s", repoName))

	return remote, user
}
