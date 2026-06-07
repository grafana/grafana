package git

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	apicommon "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_GitRequiresNewTokenWhenRepositoryURLChanges(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	repoName := "git-url-change-test"
	helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON(repoName+"-dashboard", "Dashboard", 1),
	}, "write")

	t.Run("update rejects url change without a new token", func(t *testing.T) {
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repo, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
			require.NoError(collect, err)
			require.NoError(collect, unstructured.SetNestedField(repo.Object, "https://some-new-url/", "spec", "git", "url"))
			unstructured.RemoveNestedField(repo.Object, "secure", "token")

			_, err = helper.Repositories.Resource.Update(ctx, repo, metav1.UpdateOptions{})
			require.Error(collect, err)
			require.True(collect, apierrors.IsInvalid(err), "expected invalid repository update, got %v", err)
			require.ErrorContains(collect, err, "secure.token")
			require.ErrorContains(collect, err, "a new token is required when changing the repository URL")
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
	})

	t.Run("update allows url change with a new token", func(t *testing.T) {
		changedRemote, changedUser := createEmptyGitRepo(t, helper, "git-url-change-new-token-new")

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repo, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
			require.NoError(collect, err)

			repoObj := common.UnstructuredToRepository(t, repo)
			repoObj.Spec.Git.URL = changedRemote.URL
			repoObj.Spec.Git.TokenUser = changedUser.Username
			repoObj.Secure.Token = apicommon.InlineSecureValue{Create: apicommon.RawSecureValue(changedUser.Password)}

			result, err := helper.Repositories.Resource.Update(ctx, common.RepositoryToUnstructured(t, repoObj), metav1.UpdateOptions{})
			require.NoError(collect, err)

			updatedRepo := common.UnstructuredToRepository(t, result)
			require.Equal(collect, changedRemote.URL, updatedRepo.Spec.Git.URL)
			require.NotEmpty(collect, updatedRepo.Secure.Token.Name)
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
	})

	t.Run("test subresource rejects url change without a new token", func(t *testing.T) {
		changedRemote, changedUser := createEmptyGitRepo(t, helper, "git-url-change-test-no-token-new")

		repoConfig := map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"spec": map[string]any{
				"title": "Changed Git Repo URL",
				"type":  "git",
				"git": map[string]any{
					"url":       changedRemote.URL,
					"branch":    "main",
					"tokenUser": changedUser.Username,
				},
				"sync": map[string]any{
					"enabled":         false,
					"target":          "instance",
					"intervalSeconds": 60,
				},
				"workflows": []string{},
			},
		}

		configBytes, err := json.Marshal(repoConfig)
		require.NoError(t, err)

		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("test").
			Body(configBytes).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error())
		require.Equal(t, http.StatusBadRequest, statusCode)
		require.True(t, apierrors.IsBadRequest(result.Error()), "expected bad request, got %v", result.Error())
		require.ErrorContains(t, result.Error(), "a new token is required when changing the repository URL")
	})

	t.Run("test subresource allows url change with a new token", func(t *testing.T) {
		changedRemote, changedUser := createEmptyGitRepo(t, helper, "git-url-change-test-no-token-new")

		local, err := gittest.NewLocalRepo(ctx)
		require.NoError(t, err, "failed to create local repository")
		t.Cleanup(func() {
			if err := local.Cleanup(); err != nil {
				t.Logf("failed to cleanup local repo: %v", err)
			}
		})

		_, err = local.InitWithRemote(changedUser, changedRemote)
		require.NoError(t, err, "failed to initialize local repo with remote")

		repoConfig := map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"spec": map[string]any{
				"title": "Changed Git Repo URL",
				"type":  "git",
				"git": map[string]any{
					"url":       changedRemote.URL,
					"branch":    "main",
					"tokenUser": changedUser.Username,
				},
				"sync": map[string]any{
					"enabled":         false,
					"target":          "instance",
					"intervalSeconds": 60,
				},
				"workflows": []string{},
			},
			"secure": map[string]any{
				"token": map[string]any{
					"create": changedUser.Password,
				},
			},
		}

		configBytes, err := json.Marshal(repoConfig)
		require.NoError(t, err)

		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("test").
			Body(configBytes).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error())
		require.Equal(t, http.StatusOK, statusCode)
	})
}
