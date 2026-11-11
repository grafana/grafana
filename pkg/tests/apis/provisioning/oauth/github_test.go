package oauth

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common/oauthsuite"
)

func TestIntegrationProvisioning_GithubOAuthConnection(t *testing.T) {
	oauthsuite.Run(t, githubHelper, githubProvider)
}

func TestIntegrationProvisioning_GithubOAuthNonExpiringToken(t *testing.T) {
	helper := githubHelper(t)
	const name = "github-oauth-non-expiring"
	oauthsuite.CreateConnection(t, helper, githubProvider, name)

	conn := oauthsuite.Authorize(t, helper, name, oauthsuite.MockNonExpiringCode)
	require.Zero(t, conn.Status.Token.Expiration, "a GitHub OAuth app token without expires_in must not expire")
	helper.WaitForHealthyConnection(t, name)
}

var githubProvider = func() oauthsuite.Provider {
	p := oauthsuite.NewMockProvider("github", provisioning.GithubOAuthConnectionType, nil)
	p.Repositories = []provisioning.ExternalRepository{
		{Name: "oauth-repo-1", Owner: "oauth-owner-1", URL: "https://github.com/oauth-owner-1/oauth-repo-1"},
		{Name: "oauth-repo-2", Owner: "oauth-owner-2", URL: "https://github.com/oauth-owner-2/oauth-repo-2"},
	}
	return p
}()

type mockGithub struct {
	tokens *oauthsuite.MockTokens
	base   http.RoundTripper
}

func (f *mockGithub) RoundTrip(req *http.Request) (*http.Response, error) {
	switch {
	case req.URL.Host != "github.com" && req.URL.Host != "api.github.com" && f.base != nil:
		return f.base.RoundTrip(req)
	case req.Method == http.MethodPost && strings.HasSuffix(req.URL.Path, "/login/oauth/access_token"):
		return common.ServeRecorded(req, f.tokens.HandleToken), nil
	case req.Method == http.MethodGet && strings.HasSuffix(req.URL.Path, "/user/repos"):
		return common.ServeRecorded(req, func(w http.ResponseWriter, r *http.Request) {
			if !f.tokens.Authorized(r) {
				common.WriteJSON(w, http.StatusUnauthorized, map[string]any{"message": "Bad credentials"})
				return
			}
			common.WriteJSON(w, http.StatusOK, []map[string]any{
				{"name": "oauth-repo-1", "owner": map[string]any{"login": "oauth-owner-1"}, "html_url": "https://github.com/oauth-owner-1/oauth-repo-1"},
				{"name": "oauth-repo-2", "owner": map[string]any{"login": "oauth-owner-2"}, "html_url": "https://github.com/oauth-owner-2/oauth-repo-2"},
			})
		}), nil
	case f.base != nil:
		return f.base.RoundTrip(req)
	default:
		return common.ServeRecorded(req, func(w http.ResponseWriter, _ *http.Request) {
			common.WriteJSON(w, http.StatusNotFound, map[string]any{"message": "Not Found"})
		}), nil
	}
}

func githubHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	mock := &mockGithub{tokens: oauthsuite.NewMockTokens(), base: http.DefaultTransport}
	http.DefaultTransport = mock
	t.Cleanup(func() { http.DefaultTransport = mock.base })

	helper := env.GetCleanHelper(t).ProvisioningTestHelper
	helper.GetEnv().GithubRepoFactory.Client = &http.Client{Transport: mock}
	return helper
}
