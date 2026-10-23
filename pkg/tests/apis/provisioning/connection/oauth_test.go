package connection

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common/oauthsuite"
)

type githubOAuthTransport struct {
	tokens *oauthsuite.FakeTokens
	base   http.RoundTripper
}

func (f *githubOAuthTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	switch {
	case req.Method == http.MethodPost && strings.HasSuffix(req.URL.Path, "/login/oauth/access_token"):
		return oauthsuite.ServeRecorded(req, f.tokens.HandleToken), nil
	case req.Method == http.MethodGet && strings.HasSuffix(req.URL.Path, "/user/repos"):
		return oauthsuite.ServeRecorded(req, func(w http.ResponseWriter, r *http.Request) {
			if !f.tokens.Authorized(r) {
				oauthsuite.WriteJSON(w, http.StatusUnauthorized, map[string]any{"message": "Bad credentials"})
				return
			}
			oauthsuite.WriteJSON(w, http.StatusOK, []map[string]any{
				{"name": "oauth-repo-1", "owner": map[string]any{"login": "oauth-owner-1"}, "html_url": "https://github.com/oauth-owner-1/oauth-repo-1"},
				{"name": "oauth-repo-2", "owner": map[string]any{"login": "oauth-owner-2"}, "html_url": "https://github.com/oauth-owner-2/oauth-repo-2"},
			})
		}), nil
	case f.base != nil:
		return f.base.RoundTrip(req)
	default:
		return oauthsuite.ServeRecorded(req, func(w http.ResponseWriter, _ *http.Request) {
			oauthsuite.WriteJSON(w, http.StatusNotFound, map[string]any{"message": "Not Found"})
		}), nil
	}
}

func oauthHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	tokens := oauthsuite.NewFakeTokens()
	base := http.DefaultTransport
	http.DefaultTransport = &githubOAuthTransport{tokens: tokens, base: base}
	t.Cleanup(func() { http.DefaultTransport = base })

	helper := sharedHelper(t)
	helper.GetEnv().GithubRepoFactory.Client = &http.Client{Transport: &githubOAuthTransport{tokens: tokens}}
	return helper
}

func TestIntegrationProvisioning_OAuthConnection(t *testing.T) {
	oauthsuite.Run(t, oauthHelper, &oauthsuite.FakeProvider{
		ProviderName: "github",
		Type:         provisioning.GithubOAuthConnectionType,
		Repos: []provisioning.ExternalRepository{
			{Name: "oauth-repo-1", Owner: "oauth-owner-1", URL: "https://github.com/oauth-owner-1/oauth-repo-1"},
			{Name: "oauth-repo-2", Owner: "oauth-owner-2", URL: "https://github.com/oauth-owner-2/oauth-repo-2"},
		},
	})
}

func TestIntegrationProvisioning_OAuthConnectionAuthorizeRejectsGithubApp(t *testing.T) {
	helper := oauthHelper(t)

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
		Spec: provisioning.ConnectionAuthorizeRequestSpec{Code: oauthsuite.FakeAuthorizationCode},
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
}
