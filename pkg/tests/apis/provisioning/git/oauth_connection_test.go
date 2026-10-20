package git

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"testing"

	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_GitOAuthConnection(t *testing.T) {
	helper := sharedGitHelper(t)
	server := helper.GitServer()

	const (
		repoName       = "git-oauth-connection"
		connectionName = "git-oauth-connection"
		dashboardUID   = "git-oauth-dashboard"
		redirectURI    = "http://grafana.example/callback"
	)

	user, err := server.CreateUser(t.Context())
	require.NoError(t, err, "failed to create user")
	remote, _ := helper.CreateRemoteGitRepo(t, repoName, user, map[string][]byte{
		"dashboard.json": common.DashboardJSON(dashboardUID, "Git OAuth Dashboard", 1),
	})

	giteaAPI(t, user, http.MethodPatch, server.URL()+"/api/v1/repos/"+remote.Owner+"/"+remote.Name, map[string]any{"private": true}, nil)
	req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, remote.URL+"/info/refs?service=git-upload-pack", nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode, "private repository should require credentials")

	var app struct {
		ClientID     string `json:"client_id"`
		ClientSecret string `json:"client_secret"`
	}
	giteaAPI(t, user, http.MethodPost, server.URL()+"/api/v1/user/applications/oauth2", map[string]any{
		"name":                "grafana",
		"redirect_uris":       []string{redirectURI},
		"confidential_client": true,
	}, &app)

	_, err = helper.Connections.Resource.Create(t.Context(), &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": provisioning.APIVERSION,
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      connectionName,
			"namespace": helper.Namespace,
		},
		"spec": map[string]any{
			"title": connectionName,
			"type":  string(provisioning.GitOAuthConnectionType),
			"gitOAuth": map[string]any{
				"authURL":  server.URL() + "/login/oauth/authorize",
				"tokenURL": server.URL() + "/login/oauth/access_token",
			},
			"oauth": map[string]any{"clientID": app.ClientID},
		},
		"secure": map[string]any{
			"clientSecret": map[string]any{"create": app.ClientSecret},
		},
	}}, metav1.CreateOptions{FieldValidation: "Strict"})
	require.NoError(t, err, "failed to create connection")

	helper.AuthorizeConnection(t, connectionName, giteaAuthorizationCode(t, server, user, app.ClientID, redirectURI), redirectURI)
	helper.WaitForHealthyConnection(t, connectionName)

	repoObj := helper.RenderObject(t, common.TestdataPath("git.json.tmpl"), map[string]any{
		"Name":           repoName,
		"URL":            remote.URL,
		"Branch":         "main",
		"TokenUser":      user.Username,
		"ConnectionName": connectionName,
		"WorkflowsJSON":  `["write"]`,
	})
	_, err = helper.Repositories.Resource.Create(t.Context(), repoObj, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create repository")
	helper.WaitForHealthyRepository(t, repoName)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		require.NoError(collect, err)
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		require.False(collect, repo.Secure.Token.IsZero(), "repository token should be generated from the connection")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	helper.SyncAndWait(t, repoName)
	common.RequireRepoManagedDashboard(t, helper.DashboardsV1, dashboardUID, repoName, "dashboard.json")
}

func giteaAPI(t *testing.T, user *gittest.User, method, endpoint string, payload, into any) {
	t.Helper()

	body, err := json.Marshal(payload)
	require.NoError(t, err)
	req, err := http.NewRequestWithContext(t.Context(), method, endpoint, bytes.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(user.Username, user.Password)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	require.Less(t, resp.StatusCode, http.StatusMultipleChoices, "%s %s returned %d", method, endpoint, resp.StatusCode)
	if into != nil {
		require.NoError(t, json.NewDecoder(resp.Body).Decode(into))
	}
}

func giteaAuthorizationCode(t *testing.T, server *gittest.Server, user *gittest.User, clientID, redirectURI string) string {
	t.Helper()

	jar, err := cookiejar.New(nil)
	require.NoError(t, err)
	client := &http.Client{
		Jar: jar,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	send := func(method, endpoint string, form url.Values) (int, string) {
		t.Helper()
		req, err := http.NewRequestWithContext(t.Context(), method, endpoint, strings.NewReader(form.Encode()))
		require.NoError(t, err)
		if form != nil {
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		}
		resp, err := client.Do(req)
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()
		return resp.StatusCode, resp.Header.Get("Location")
	}

	status, _ := send(http.MethodPost, server.URL()+"/user/login", url.Values{
		"user_name": {user.Username},
		"password":  {user.Password},
	})
	require.Equal(t, http.StatusSeeOther, status, "gitea login should redirect")

	params := url.Values{
		"client_id":     {clientID},
		"redirect_uri":  {redirectURI},
		"response_type": {"code"},
		"state":         {"state"},
	}
	status, _ = send(http.MethodGet, server.URL()+"/login/oauth/authorize?"+params.Encode(), nil)
	require.Equal(t, http.StatusOK, status, "gitea should show the consent page")

	status, location := send(http.MethodPost, server.URL()+"/login/oauth/grant", url.Values{
		"client_id":    {clientID},
		"redirect_uri": {redirectURI},
		"state":        {"state"},
		"scope":        {""},
		"nonce":        {""},
		"granted":      {"true"},
	})
	require.Equal(t, http.StatusSeeOther, status, "gitea should redirect back with a code")

	redirect, err := url.Parse(location)
	require.NoError(t, err)
	code := redirect.Query().Get("code")
	require.NotEmpty(t, code, "redirect should carry an authorization code: %s", location)
	return code
}
