package repository

import (
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_ConnectionRepositoryURLChange checks that a repository
// authenticating through a connection can be repointed at another repository on the same
// host without the caller supplying a token, since the connection mints one itself. Clients
// that send only the spec (Terraform) have no way to provide one.
func TestIntegrationProvisioning_ConnectionRepositoryURLChange(t *testing.T) {
	helper := sharedHelper(t)

	const connectionName = "conn-url-change"
	const repoName = "repo-conn-url-change"

	connection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      connectionName,
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "URL Change Connection",
			"type":  "github",
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "454545",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM)),
			},
		},
	}}
	_, err := helper.CreateGithubConnection(t, connection)
	require.NoError(t, err, "failed to create connection")

	repo := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata": map[string]any{
			"name":      repoName,
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Connection Backed Repo",
			"type":  "github",
			"sync": map[string]any{
				"enabled": false,
				"target":  "folder",
			},
			"github": map[string]any{
				"url":    "https://github.com/grafana/repo-a",
				"branch": "main",
			},
			"connection": map[string]any{
				"name": connectionName,
			},
		},
	}}
	_, err = helper.Repositories.Resource.Create(t.Context(), repo, metav1.CreateOptions{FieldValidation: "Strict"})
	require.NoError(t, err, "failed to create connection-backed repository")

	// The controller mints the token from the connection and stores it by reference, which
	// is the state a Terraform-driven update starts from.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		current, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		require.NoError(collect, err)
		stored := common.MustFromUnstructured[provisioning.Repository](t, current)
		require.NotEmpty(collect, stored.Secure.Token.Name, "token should be minted from the connection")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "connection token should be generated")

	t.Run("allows url change on the same host without a new token", func(t *testing.T) {
		updated := updateRepositoryURL(t, helper, repoName, "https://github.com/grafana/repo-b")

		result, err := helper.Repositories.Resource.Update(t.Context(), updated, metav1.UpdateOptions{})
		require.NoError(t, err)

		stored := common.MustFromUnstructured[provisioning.Repository](t, result)
		assert.Equal(t, "https://github.com/grafana/repo-b", stored.Spec.GitHub.URL)
		assert.NotEmpty(t, stored.Secure.Token.Name, "existing token reference should be preserved")
	})

	t.Run("rejects host change without a new token", func(t *testing.T) {
		updated := updateRepositoryURL(t, helper, repoName, "https://ghe.example.com/grafana/repo-b")

		_, err := helper.Repositories.Resource.Update(t.Context(), updated, metav1.UpdateOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsInvalid(err), "expected invalid repository update, got %v", err)
		assert.ErrorContains(t, err, "secure.token")
		assert.ErrorContains(t, err, "a new token is required when changing the repository URL")
	})
}

// updateRepositoryURL returns the stored repository with a new URL and no secure values,
// mirroring a client that only ever sends the spec.
func updateRepositoryURL(
	t *testing.T,
	helper *common.ProvisioningTestHelper,
	name string,
	url string,
) *unstructured.Unstructured {
	t.Helper()

	current, err := helper.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
	require.NoError(t, err)

	updated := current.DeepCopy()
	require.NoError(t, unstructured.SetNestedField(updated.Object, url, "spec", "github", "url"))
	unstructured.RemoveNestedField(updated.Object, "secure")

	return updated
}
