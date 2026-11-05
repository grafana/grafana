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
	var mintedAt int64
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		current, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		require.NoError(collect, err)
		stored := common.MustFromUnstructured[provisioning.Repository](t, current)
		require.NotEmpty(collect, stored.Secure.Token.Name, "token should be minted from the connection")
		require.NotZero(collect, stored.Status.Token.LastUpdated, "token status should be stamped")
		mintedAt = stored.Status.Token.LastUpdated
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "connection token should be generated")

	t.Run("allows url change on the same host without a new token", func(t *testing.T) {
		result, err := updateRepositoryURL(t, helper, repoName, "https://github.com/grafana/repo-b")
		require.NoError(t, err)

		stored := common.MustFromUnstructured[provisioning.Repository](t, result)
		assert.Equal(t, "https://github.com/grafana/repo-b", stored.Spec.GitHub.URL)

		// A GitHub App token is scoped to the repository it was minted for, so the old one
		// cannot reach repo-b. The controller has to replace it rather than keep it.
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			current, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
			require.NoError(collect, err)
			reconciled := common.MustFromUnstructured[provisioning.Repository](t, current)
			require.NotEmpty(collect, reconciled.Secure.Token.Name, "a token should be stored again")
			require.Greater(collect, reconciled.Status.Token.LastUpdated, mintedAt,
				"token should be re-minted for the new repository")
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "token should be regenerated after the url change")
	})

	// A host change is never silently accepted. Which guard rejects it first depends on
	// whether the host resolves, so the exact message is pinned by the unit tests instead.
	t.Run("rejects host change without a new token", func(t *testing.T) {
		_, err := updateRepositoryURL(t, helper, repoName, "https://ghe.example.com/grafana/repo-b")
		require.Error(t, err)
		require.True(t, apierrors.IsInvalid(err), "expected invalid repository update, got %v", err)

		current, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		require.NoError(t, err)
		stored := common.MustFromUnstructured[provisioning.Repository](t, current)
		assert.Equal(t, "https://github.com/grafana/repo-b", stored.Spec.GitHub.URL, "url must not have moved host")
	})
}

// updateRepositoryURL repoints the stored repository at url, sending no secure values at
// all, which mirrors a client that only ever sends the spec. The repository is re-read on
// conflict because the controller patches status concurrently.
func updateRepositoryURL(
	t *testing.T,
	helper *common.ProvisioningTestHelper,
	name string,
	url string,
) (*unstructured.Unstructured, error) {
	t.Helper()

	var result *unstructured.Unstructured
	err := common.RetryOnConflict(t, func() error {
		current, err := helper.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
		if err != nil {
			return err
		}

		updated := current.DeepCopy()
		if err := unstructured.SetNestedField(updated.Object, url, "spec", "github", "url"); err != nil {
			return err
		}
		unstructured.RemoveNestedField(updated.Object, "secure")

		result, err = helper.Repositories.Resource.Update(t.Context(), updated, metav1.UpdateOptions{})
		return err
	})

	return result, err
}
