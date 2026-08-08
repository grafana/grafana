package connection

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/githuboauth"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// githubOAuthTransport fakes the two GitHub endpoints OAuth app connections
// talk to: the authorization code exchange and the repository listing.
type githubOAuthTransport struct {
	accessToken string
}

func (f *githubOAuthTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	var body string
	switch {
	case req.Method == http.MethodPost && strings.HasSuffix(req.URL.Path, "/login/oauth/access_token"):
		body = fmt.Sprintf(`{"access_token":%q,"token_type":"bearer","scope":"repo"}`, f.accessToken)
	case req.Method == http.MethodGet && strings.HasSuffix(req.URL.Path, "/user/repos"):
		body = `[
			{"name":"oauth-repo-1","owner":{"login":"oauth-owner-1"},"html_url":"https://github.com/oauth-owner-1/oauth-repo-1"},
			{"name":"oauth-repo-2","owner":{"login":"oauth-owner-2"},"html_url":"https://github.com/oauth-owner-2/oauth-repo-2"}
		]`
	default:
		return &http.Response{
			StatusCode: http.StatusNotFound,
			Body:       io.NopCloser(strings.NewReader(`{"message":"Not Found"}`)),
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Request:    req,
		}, nil
	}

	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Request:    req,
	}, nil
}

func oauthHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	helper := sharedHelper(t)
	githuboauth.Default.Client = &http.Client{Transport: &githubOAuthTransport{accessToken: "fake-access-token"}}
	t.Cleanup(func() { githuboauth.Default.Client = nil })
	return helper
}

func newGithubOAuthConnection(name, clientID string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      name,
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Test GitHub OAuth Connection",
			"type":  string(provisioning.GithubOAuthConnectionType),
			"oauth": map[string]any{
				"clientID": clientID,
			},
		},
		"secure": map[string]any{
			"clientSecret": map[string]any{
				"create": "test-client-secret",
			},
		},
	}}
}

func authorizeConnection(t *testing.T, helper *common.ProvisioningTestHelper, name string) {
	t.Helper()
	body, err := json.Marshal(&provisioning.ConnectionAuthorizeRequest{
		Spec: provisioning.ConnectionAuthorizeRequestSpec{
			Code:        "test-authorization-code",
			RedirectURI: "https://grafana.example.com/callback",
		},
	})
	require.NoError(t, err)

	var statusCode int
	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("connections").
		Name(name).
		SubResource("authorize").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(t.Context()).
		StatusCode(&statusCode)
	require.NoError(t, result.Error(), "authorize should succeed")
	require.Equal(t, http.StatusOK, statusCode)

	var res provisioning.ConnectionAuthorizeRequest
	require.NoError(t, result.Into(&res))
	assert.True(t, res.Status.Authorized, "response should report authorized")
	assert.Empty(t, res.Spec.Code, "authorization code should not be echoed back")
}

func TestIntegrationProvisioning_OAuthConnectionCRUDL(t *testing.T) {
	helper := oauthHelper(t)

	t.Run("should perform CRUDL requests on githubOAuth connection", func(t *testing.T) {
		connection := newGithubOAuthConnection("oauth-crudl", "test-client-id")

		// CREATE without a token: the connection is not authorized yet
		c, err := helper.Connections.Resource.Create(t.Context(), connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to create resource")
		connectionName := c.GetName()

		// READ
		output, err := helper.Connections.Resource.Get(t.Context(), connectionName, metav1.GetOptions{})
		require.NoError(t, err, "failed to read back resource")
		spec := output.Object["spec"].(map[string]any)
		assert.Equal(t, "githubOAuth", spec["type"], "type should be equal")
		oauthInfo := spec["oauth"].(map[string]any)
		assert.Equal(t, "test-client-id", oauthInfo["clientID"], "clientID should be equal")
		require.Contains(t, output.Object, "secure", "object should contain secure")
		secure := output.Object["secure"].(map[string]any)
		assert.Contains(t, secure, "clientSecret", "secure should contain clientSecret")
		assert.NotContains(t, secure, "token", "secure should not contain a token before authorization")

		// LIST
		list, err := helper.Connections.Resource.List(t.Context(), metav1.ListOptions{})
		require.NoError(t, err, "failed to list resource")
		assert.Equal(t, 1, len(list.Items), "should have one connection")

		// UPDATE (same credentials)
		updated := output.DeepCopy()
		updated.SetResourceVersion("")
		spec = updated.Object["spec"].(map[string]any)
		spec["title"] = "Updated GitHub OAuth Connection"
		res, err := helper.Connections.Resource.Update(t.Context(), updated, metav1.UpdateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to update resource")
		assert.Equal(t, "Updated GitHub OAuth Connection", res.Object["spec"].(map[string]any)["title"])

		// DELETE
		require.Eventually(t, func() bool {
			err := helper.Connections.Resource.Delete(t.Context(), connectionName, metav1.DeleteOptions{})
			if err != nil {
				return apierrors.IsNotFound(err)
			}
			return true
		}, 5*time.Second, 100*time.Millisecond, "should successfully delete resource")
	})
}

func TestIntegrationProvisioning_OAuthConnectionMutation(t *testing.T) {
	helper := oauthHelper(t)

	t.Run("should prefix generated githubOAuth connection names with type", func(t *testing.T) {
		connection := newGithubOAuthConnection("", "test-client-id")

		c, err := helper.Connections.Resource.Create(t.Context(), connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to create resource")
		require.Contains(t, c.GetName(), fmt.Sprintf("%s-", provisioning.GithubOAuthConnectionType), "name should have the type prefix")
	})
}

func TestIntegrationProvisioning_OAuthConnectionValidation(t *testing.T) {
	helper := oauthHelper(t)

	t.Run("should fail when 'oauth' field is missing", func(t *testing.T) {
		connection := newGithubOAuthConnection("oauth-validation-no-oauth", "test-client-id")
		delete(connection.Object["spec"].(map[string]any), "oauth")

		_, err := helper.Connections.Resource.Create(t.Context(), connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.Error(t, err, "creation should fail")
		assert.Contains(t, err.Error(), "oauth info must be specified for OAuth app connections")
	})

	t.Run("should fail when client secret is missing", func(t *testing.T) {
		connection := newGithubOAuthConnection("oauth-validation-no-secret", "test-client-id")
		delete(connection.Object, "secure")

		_, err := helper.Connections.Resource.Create(t.Context(), connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.Error(t, err, "creation should fail")
		assert.Contains(t, err.Error(), "clientSecret must be specified for OAuth app connections")
	})

	t.Run("should fail when a private key is specified", func(t *testing.T) {
		connection := newGithubOAuthConnection("oauth-validation-private-key", "test-client-id")
		connection.Object["secure"].(map[string]any)["privateKey"] = map[string]any{
			"create": "some-private-key",
		}

		_, err := helper.Connections.Resource.Create(t.Context(), connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.Error(t, err, "creation should fail")
		assert.Contains(t, err.Error(), "privateKey is forbidden in OAuth app connections")
	})
}

func TestIntegrationProvisioning_OAuthConnectionAuthorize(t *testing.T) {
	helper := oauthHelper(t)

	t.Run("authorize exchanges the code and stores the token", func(t *testing.T) {
		connection := newGithubOAuthConnection("oauth-authorize", "test-client-id")
		_, err := helper.Connections.Resource.Create(t.Context(), connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to create resource")

		authorizeConnection(t, helper, "oauth-authorize")

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			output, err := helper.Connections.Resource.Get(t.Context(), "oauth-authorize", metav1.GetOptions{})
			if !assert.NoError(collect, err) {
				return
			}
			secure, _ := output.Object["secure"].(map[string]any)
			assert.Contains(collect, secure, "token", "secure should contain the exchanged token")
			status, _ := output.Object["status"].(map[string]any)
			tokenStatus, _ := status["token"].(map[string]any)
			if assert.NotNil(collect, tokenStatus, "status should contain token info") {
				lastUpdated, _ := tokenStatus["lastUpdated"].(int64)
				assert.Positive(collect, lastUpdated, "lastUpdated should be set")
			}
		}, 10*time.Second, 250*time.Millisecond, "token should be stored after authorize")
	})

	t.Run("authorize is rejected for non-OAuth connections", func(t *testing.T) {
		privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(common.TestGithubPrivateKeyPEM))
		appConnection := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Connection",
			"metadata": map[string]any{
				"name":      "github-app-connection",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test GitHub App Connection",
				"type":  provisioning.GitHubRepositoryType,
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
		}}
		_, err := helper.CreateGithubConnection(t, appConnection)
		require.NoError(t, err)

		body, err := json.Marshal(&provisioning.ConnectionAuthorizeRequest{
			Spec: provisioning.ConnectionAuthorizeRequestSpec{Code: "test-authorization-code"},
		})
		require.NoError(t, err)

		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("connections").
			Name("github-app-connection").
			SubResource("authorize").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).
			StatusCode(&statusCode)
		require.Error(t, result.Error(), "authorize should fail for github app connections")
		require.Equal(t, http.StatusNotImplemented, statusCode, "should return 501 Not Implemented")
	})

	t.Run("viewer cannot authorize", func(t *testing.T) {
		body, err := json.Marshal(&provisioning.ConnectionAuthorizeRequest{
			Spec: provisioning.ConnectionAuthorizeRequestSpec{Code: "test-authorization-code"},
		})
		require.NoError(t, err)

		var statusCode int
		result := helper.ViewerREST.Post().
			Namespace("default").
			Resource("connections").
			Name("oauth-authorize").
			SubResource("authorize").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).
			StatusCode(&statusCode)
		require.Error(t, result.Error(), "viewer should not be able to authorize")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
	})
}

func TestIntegrationProvisioning_OAuthConnectionTokenDropOnCredentialChange(t *testing.T) {
	helper := oauthHelper(t)

	setup := func(t *testing.T, name string) *unstructured.Unstructured {
		t.Helper()
		connection := newGithubOAuthConnection(name, "test-client-id")
		_, err := helper.Connections.Resource.Create(t.Context(), connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to create resource")
		authorizeConnection(t, helper, name)

		var output *unstructured.Unstructured
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			var err error
			output, err = helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
			if !assert.NoError(collect, err) {
				return
			}
			secure, _ := output.Object["secure"].(map[string]any)
			assert.Contains(collect, secure, "token", "secure should contain the exchanged token")
		}, 10*time.Second, 250*time.Millisecond, "token should be stored after authorize")
		return output
	}

	update := func(t *testing.T, name string, mutate func(obj *unstructured.Unstructured)) {
		t.Helper()
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			output, err := helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
			if !assert.NoError(collect, err) {
				return
			}
			updated := output.DeepCopy()
			delete(updated.Object["secure"].(map[string]any), "token")
			mutate(updated)
			_, err = helper.Connections.Resource.Update(t.Context(), updated, metav1.UpdateOptions{FieldValidation: "Strict"})
			assert.NoError(collect, err)
		}, 10*time.Second, 250*time.Millisecond, "update should succeed")
	}

	t.Run("token is kept when credentials are unchanged", func(t *testing.T) {
		setup(t, "oauth-token-kept")

		update(t, "oauth-token-kept", func(obj *unstructured.Unstructured) {
			obj.Object["spec"].(map[string]any)["title"] = "Updated title"
		})

		output, err := helper.Connections.Resource.Get(t.Context(), "oauth-token-kept", metav1.GetOptions{})
		require.NoError(t, err)
		secure, _ := output.Object["secure"].(map[string]any)
		assert.Contains(t, secure, "token", "token should be preserved when credentials are unchanged")
	})

	t.Run("token is dropped when the client ID is changed", func(t *testing.T) {
		setup(t, "oauth-token-drop-id")

		update(t, "oauth-token-drop-id", func(obj *unstructured.Unstructured) {
			obj.Object["spec"].(map[string]any)["oauth"].(map[string]any)["clientID"] = "another-client-id"
		})

		output, err := helper.Connections.Resource.Get(t.Context(), "oauth-token-drop-id", metav1.GetOptions{})
		require.NoError(t, err)
		secure, _ := output.Object["secure"].(map[string]any)
		assert.NotContains(t, secure, "token", "token should be dropped when the client ID changes")
	})

	t.Run("token is dropped when the client secret is changed", func(t *testing.T) {
		setup(t, "oauth-token-drop-secret")

		update(t, "oauth-token-drop-secret", func(obj *unstructured.Unstructured) {
			obj.Object["secure"].(map[string]any)["clientSecret"] = map[string]any{
				"create": "another-client-secret",
			}
		})

		output, err := helper.Connections.Resource.Get(t.Context(), "oauth-token-drop-secret", metav1.GetOptions{})
		require.NoError(t, err)
		secure, _ := output.Object["secure"].(map[string]any)
		assert.NotContains(t, secure, "token", "token should be dropped when the client secret changes")
	})
}

func TestIntegrationProvisioning_OAuthConnectionRepositories(t *testing.T) {
	helper := oauthHelper(t)

	connection := newGithubOAuthConnection("oauth-repositories", "test-client-id")
	_, err := helper.Connections.Resource.Create(t.Context(), connection, metav1.CreateOptions{FieldValidation: "Strict"})
	require.NoError(t, err)
	authorizeConnection(t, helper, "oauth-repositories")

	t.Run("admin can list repositories through an authorized oauth connection", func(t *testing.T) {
		var resultList provisioning.ExternalRepositoryList
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			result := helper.AdminREST.Get().
				Namespace("default").
				Resource("connections").
				Name("oauth-repositories").
				SubResource("repositories").
				Do(t.Context())
			if !assert.NoError(collect, result.Error()) {
				return
			}
			assert.NoError(collect, result.Into(&resultList))
		}, 10*time.Second, 250*time.Millisecond, "repositories listing should succeed")

		require.Len(t, resultList.Items, 2, "should return 2 repositories")
		assert.Equal(t, "oauth-repo-1", resultList.Items[0].Name)
		assert.Equal(t, "oauth-owner-1", resultList.Items[0].Owner)
		assert.Equal(t, "https://github.com/oauth-owner-1/oauth-repo-1", resultList.Items[0].URL)
	})
}

func TestIntegrationConnectionController_OAuthNoTokenGeneration(t *testing.T) {
	helper := oauthHelper(t)

	t.Run("controller does not mint tokens for unauthorized oauth connections", func(t *testing.T) {
		connection := newGithubOAuthConnection("oauth-no-mint", "test-client-id")
		_, err := helper.Connections.Resource.Create(t.Context(), connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(t, err)

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			output, err := helper.Connections.Resource.Get(t.Context(), "oauth-no-mint", metav1.GetOptions{})
			if !assert.NoError(collect, err) {
				return
			}
			status, _ := output.Object["status"].(map[string]any)
			observed, _ := status["observedGeneration"].(int64)
			assert.Equal(collect, int64(1), observed, "controller should have reconciled the connection")
		}, 10*time.Second, 250*time.Millisecond, "connection should be reconciled")

		output, err := helper.Connections.Resource.Get(t.Context(), "oauth-no-mint", metav1.GetOptions{})
		require.NoError(t, err)
		secure, _ := output.Object["secure"].(map[string]any)
		assert.NotContains(t, secure, "token", "controller must not mint a token for oauth connections")
	})
}
