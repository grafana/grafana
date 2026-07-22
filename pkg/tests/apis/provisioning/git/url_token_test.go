package git

import (
	"encoding/json"
	"net/http"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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

	repoName := "git-url-change-test"
	helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON(repoName+"-dashboard", "Dashboard", 1),
	}, "write")

	t.Run("update rejects url change without a new token", func(t *testing.T) {
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repo, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
			require.NoError(collect, err)
			updated := common.MustToUnstructured(t, repo)
			require.NoError(collect, unstructured.SetNestedField(updated.Object, "https://some-new-url/", "spec", "git", "url"))
			unstructured.RemoveNestedField(updated.Object, "secure", "token")

			_, err = helper.Repositories.Resource.Update(t.Context(), updated, metav1.UpdateOptions{})
			require.Error(collect, err)
			require.True(collect, apierrors.IsInvalid(err), "expected invalid repository update, got %v", err)
			require.ErrorContains(collect, err, "secure.token")
			require.ErrorContains(collect, err, "a new token is required when changing the repository URL")
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
	})

	t.Run("update allows url change with a new token", func(t *testing.T) {
		changedRemote, changedUser := createEmptyGitRepo(t, helper, "git-url-change-new-token-new")

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repo, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
			require.NoError(collect, err)

			repoObj := common.MustFromUnstructured[provisioning.Repository](t, repo)
			repoObj.Spec.Git.URL = changedRemote.URL
			repoObj.Spec.Git.TokenUser = changedUser.Username
			repoObj.Secure.Token = apicommon.InlineSecureValue{Create: apicommon.RawSecureValue(changedUser.Password)}

			result, err := helper.Repositories.Resource.Update(t.Context(), common.MustToUnstructured(t, repoObj), metav1.UpdateOptions{})
			require.NoError(collect, err)

			updatedRepo := common.MustFromUnstructured[provisioning.Repository](t, result)
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
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error())
		require.Equal(t, http.StatusBadRequest, statusCode)
		require.True(t, apierrors.IsBadRequest(result.Error()), "expected bad request, got %v", result.Error())
		require.ErrorContains(t, result.Error(), "a new token is required when changing the repository URL")
	})

	t.Run("test subresource allows url change with a new token", func(t *testing.T) {
		changedRemote, changedUser := createEmptyGitRepo(t, helper, "git-url-change-test-no-token-new")

		local, err := gittest.NewLocalRepo(t.Context())
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
			Do(t.Context()).StatusCode(&statusCode)

		require.NoError(t, result.Error())
		require.Equal(t, http.StatusOK, statusCode)
	})
}
