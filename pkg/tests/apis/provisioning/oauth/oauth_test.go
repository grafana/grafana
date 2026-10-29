package oauth

import (
	"encoding/base64"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common/oauthsuite"
)

func TestIntegrationProvisioning_OAuthConnectionCRUDL(t *testing.T) {
	helper := githubHelper(t)
	const name = "oauth-crudl"
	expected := githubProvider.NewConnection(t, name)
	_, err := createConnection(t, helper, expected)
	require.NoError(t, err, "failed to create connection")

	output, err := helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
	require.NoError(t, err, "failed to read back connection")
	spec := output.Object["spec"].(map[string]any)
	expectedSpec := expected.Object["spec"].(map[string]any)
	assert.Equal(t, expectedSpec["type"], spec["type"])
	assert.Equal(t, expectedSpec["oauth"], spec["oauth"])
	secure := output.Object["secure"].(map[string]any)
	assert.Contains(t, secure, "clientSecret", "secure should contain clientSecret")
	assert.NotContains(t, secure, "token", "secure should not contain a token before authorization")

	list, err := helper.Connections.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err, "failed to list connections")
	assert.Len(t, list.Items, 1, "should have one connection")

	updated := output.DeepCopy()
	updated.SetResourceVersion("")
	updated.Object["spec"].(map[string]any)["title"] = "Updated title"
	res, err := helper.Connections.Resource.Update(t.Context(), updated, metav1.UpdateOptions{FieldValidation: "Strict"})
	require.NoError(t, err, "failed to update connection")
	assert.Equal(t, "Updated title", res.Object["spec"].(map[string]any)["title"])

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		err := helper.Connections.Resource.Delete(t.Context(), name, metav1.DeleteOptions{})
		assert.True(collect, err == nil || apierrors.IsNotFound(err), "delete should succeed: %v", err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "should delete connection")
}

func TestIntegrationProvisioning_OAuthConnectionMutation(t *testing.T) {
	helper := githubHelper(t)

	t.Run("generated name has the type prefix", func(t *testing.T) {
		connection := githubProvider.NewConnection(t, "unused")
		unstructured.RemoveNestedField(connection.Object, "metadata", "name")

		c, err := createConnection(t, helper, connection)
		require.NoError(t, err, "failed to create connection")
		require.True(t, strings.HasPrefix(c.GetName(), string(provisioning.GithubOAuthConnectionType)+"-"), "generated name %q should have the type prefix", c.GetName())
	})

	t.Run("generateName prefix is kept", func(t *testing.T) {
		connection := githubProvider.NewConnection(t, "unused")
		unstructured.RemoveNestedField(connection.Object, "metadata", "name")
		connection.SetGenerateName("some-name-")

		c, err := createConnection(t, helper, connection)
		require.NoError(t, err, "failed to create connection")
		require.True(t, strings.HasPrefix(c.GetName(), "some-name-"), "generated name %q should keep the requested prefix", c.GetName())
	})

	t.Run("explicit name is kept", func(t *testing.T) {
		c, err := createConnection(t, helper, githubProvider.NewConnection(t, "some-name"))
		require.NoError(t, err, "failed to create connection")
		require.Equal(t, "some-name", c.GetName())
	})
}

func TestIntegrationProvisioning_OAuthConnectionValidation(t *testing.T) {
	helper := githubHelper(t)

	for _, tt := range []struct {
		name   string
		mutate func(obj *unstructured.Unstructured)
		err    string
	}{
		{
			name:   "no-oauth",
			mutate: func(obj *unstructured.Unstructured) { unstructured.RemoveNestedField(obj.Object, "spec", "oauth") },
			err:    "oauth info must be specified for OAuth app connections",
		},
		{
			name: "no-client-id",
			mutate: func(obj *unstructured.Unstructured) {
				obj.Object["spec"].(map[string]any)["oauth"] = map[string]any{"clientID": ""}
			},
			err: "clientID must be specified for OAuth app connections",
		},
		{
			name:   "no-secret",
			mutate: func(obj *unstructured.Unstructured) { delete(obj.Object, "secure") },
			err:    "clientSecret must be specified for OAuth app connections",
		},
		{
			name: "private-key",
			mutate: func(obj *unstructured.Unstructured) {
				obj.Object["secure"].(map[string]any)["privateKey"] = map[string]any{"create": "some-private-key"}
			},
			err: "privateKey is forbidden in OAuth app connections",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			connection := githubProvider.NewConnection(t, "oauth-validation-"+tt.name)
			tt.mutate(connection)
			_, err := createConnection(t, helper, connection)
			require.ErrorContains(t, err, tt.err)
		})
	}
}

func TestIntegrationProvisioning_OAuthConnectionUnauthorized(t *testing.T) {
	helper := githubHelper(t)
	const name = "oauth-unauthorized"
	oauthsuite.CreateConnection(t, helper, githubProvider, name)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		conn, err := common.FromUnstructured[provisioning.Connection](obj)
		if !assert.NoError(collect, err) {
			return
		}
		assert.Equal(collect, conn.Generation, conn.Status.ObservedGeneration, "controller should have reconciled the connection")
		assert.Positive(collect, conn.Status.Health.Checked, "health check should have run")
		assert.False(collect, conn.Status.Health.Healthy, "unauthorized connection should be unhealthy")
		ready := meta.FindStatusCondition(conn.Status.Conditions, provisioning.ConditionTypeReady)
		if assert.NotNil(collect, ready, "connection should have a Ready condition") {
			assert.Equal(collect, metav1.ConditionFalse, ready.Status, "an unauthorized connection should not be ready")
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "connection should be reconciled")

	require.True(t, oauthsuite.GetConnection(t, helper, name).Secure.Token.IsZero(), "controller must not mint a token for oauth connections")
}

func TestIntegrationProvisioning_OAuthConnectionAuthorizeRequests(t *testing.T) {
	helper := githubHelper(t)
	const name = "oauth-authorize-requests"
	oauthsuite.CreateConnection(t, helper, githubProvider, name)

	t.Run("viewer cannot authorize", func(t *testing.T) {
		code, err := oauthsuite.PostAuthorize(t, helper.ViewerREST, name, oauthsuite.MockAuthorizationCode)
		require.Error(t, err, "viewer should not be able to authorize")
		require.Equal(t, http.StatusForbidden, code)
	})

	t.Run("an empty code is rejected", func(t *testing.T) {
		code, err := oauthsuite.PostAuthorize(t, helper.AdminREST, name, "")
		require.ErrorContains(t, err, "spec.code is required")
		require.Equal(t, http.StatusBadRequest, code)
	})

	t.Run("a GitHub App connection cannot be authorized", func(t *testing.T) {
		privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(common.TestGithubPrivateKeyPEM))
		_, err := helper.CreateGithubConnection(t, &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": provisioning.APIVERSION,
			"kind":       "Connection",
			"metadata":   map[string]any{"name": "github-app-connection", "namespace": "default"},
			"spec": map[string]any{
				"title":  "Test GitHub App Connection",
				"type":   provisioning.GitHubRepositoryType,
				"github": map[string]any{"appID": "123456", "installationID": "454545"},
			},
			"secure": map[string]any{
				"privateKey": map[string]any{"create": privateKeyBase64},
			},
		}})
		require.NoError(t, err)

		code, err := oauthsuite.PostAuthorize(t, helper.AdminREST, "github-app-connection", oauthsuite.MockAuthorizationCode)
		require.Error(t, err, "authorize should fail for GitHub App connections")
		require.Equal(t, http.StatusNotImplemented, code)
	})
}

func TestIntegrationProvisioning_OAuthConnectionTokenDropOnCredentialChange(t *testing.T) {
	helper := githubHelper(t)

	for _, tt := range []struct {
		name      string
		mutate    func(obj *unstructured.Unstructured)
		keepToken bool
	}{
		{
			name:      "kept",
			mutate:    func(obj *unstructured.Unstructured) { obj.Object["spec"].(map[string]any)["title"] = "Updated title" },
			keepToken: true,
		},
		{
			name: "drop-id",
			mutate: func(obj *unstructured.Unstructured) {
				obj.Object["spec"].(map[string]any)["oauth"].(map[string]any)["clientID"] = "another-client-id"
			},
		},
		{
			name: "drop-secret",
			mutate: func(obj *unstructured.Unstructured) {
				obj.Object["secure"].(map[string]any)["clientSecret"] = map[string]any{"create": "another-client-secret"}
			},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			name := "oauth-token-" + tt.name
			oauthsuite.CreateConnection(t, helper, githubProvider, name)
			oauthsuite.Authorize(t, helper, name, githubProvider.AuthorizationCode(t, name))

			oauthsuite.UpdateConnection(t, helper, name, tt.mutate)

			assert.Equal(t, tt.keepToken, !oauthsuite.GetConnection(t, helper, name).Secure.Token.IsZero())
		})
	}
}

func createConnection(t *testing.T, helper *common.ProvisioningTestHelper, connection *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	t.Helper()
	return helper.Connections.Resource.Create(t.Context(), connection, metav1.CreateOptions{FieldValidation: "Strict"})
}

var env = common.NewSharedGitEnv(
	common.WithoutProvisioningFolderMetadata,
	common.WithRepositoryTypes([]string{"git", "github"}),
	common.WithConnectionTypes([]string{"github", "githubOAuth", "gitOAuth"}),
)

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}
