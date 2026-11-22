package oauth

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

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

func TestIntegrationProvisioning_GithubOAuthSubmitPullRequest(t *testing.T) {
	helper, mock := githubHelperWithMock(t)
	const name = "github-oauth-submit"
	oauthsuite.CreateConnection(t, helper, githubProvider, name)
	oauthsuite.Authorize(t, helper, name, oauthsuite.MockNonExpiringCode)
	// The mock issues "<clientID>-<n>" tokens in order, and the connection got the first one.
	const connectionToken = name + "-client-1"

	_, err := helper.Repositories.Resource.Create(t.Context(), &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": provisioning.APIVERSION,
		"kind":       "Repository",
		"metadata":   map[string]any{"name": name, "namespace": "default"},
		"spec": map[string]any{
			"title":      name,
			"type":       string(provisioning.GitHubRepositoryType),
			"github":     map[string]any{"url": "https://github.com/oauth-owner-1/oauth-repo-1", "branch": "main"},
			"connection": map[string]any{"name": name},
			"sync":       map[string]any{"enabled": false, "target": "folder"},
			"workflows":  []any{"branch"},
		},
	}}, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create repository")
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		repo, err := helper.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
		require.NoError(c, err)
		lastUpdated, _, _ := unstructured.NestedInt64(repo.Object, "status", "token", "lastUpdated")
		assert.NotZero(c, lastUpdated, "the controller has not issued the repository token yet")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	submit := func(t *testing.T, spec provisioning.PullRequestSubmissionSpec) (*provisioning.PullRequestSubmission, int, error) {
		t.Helper()
		body, err := json.Marshal(&provisioning.PullRequestSubmission{Spec: spec})
		require.NoError(t, err)

		var statusCode int
		result := helper.EditorREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(name).
			SubResource("submit").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).
			StatusCode(&statusCode)
		if result.Error() != nil {
			return nil, statusCode, result.Error()
		}
		raw, err := result.Raw()
		require.NoError(t, err)
		res := &provisioning.PullRequestSubmission{}
		require.NoError(t, json.Unmarshal(raw, res))
		return res, statusCode, nil
	}

	t.Run("opens the pull request with the connection's token", func(t *testing.T) {
		res, statusCode, err := submit(t, provisioning.PullRequestSubmissionSpec{
			Ref:         "grafana-changes",
			Title:       "Update dashboards",
			Description: "Made in Grafana",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, statusCode)
		require.Equal(t, provisioning.PullRequestSubmissionStatus{Number: 1, URL: "https://github.com/oauth-owner-1/oauth-repo-1/pull/1"}, res.Status)

		pulls := mock.submittedPulls()
		require.Len(t, pulls, 1)
		require.Equal(t, "/repos/oauth-owner-1/oauth-repo-1/pulls", pulls[0].path)
		require.Equal(t, "Bearer "+connectionToken, pulls[0].authorization)
		require.Equal(t, map[string]any{"head": "grafana-changes", "base": "main", "title": "Update dashboards", "body": "Made in Grafana"}, pulls[0].body)
	})

	t.Run("rejects submitting the repository branch", func(t *testing.T) {
		_, statusCode, err := submit(t, provisioning.PullRequestSubmissionSpec{Ref: "main", Title: "Update dashboards"})
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, statusCode)
	})
}

type submittedPull struct {
	path          string
	authorization string
	body          map[string]any
}

type mockGithub struct {
	tokens *oauthsuite.MockTokens
	base   http.RoundTripper

	mu    sync.Mutex
	pulls []submittedPull
}

func (f *mockGithub) submittedPulls() []submittedPull {
	f.mu.Lock()
	defer f.mu.Unlock()
	return slices.Clone(f.pulls)
}

func (f *mockGithub) RoundTrip(req *http.Request) (*http.Response, error) {
	switch {
	case req.URL.Host != "github.com" && req.URL.Host != "api.github.com" && f.base != nil:
		return f.base.RoundTrip(req)
	case req.Method == http.MethodPost && strings.HasSuffix(req.URL.Path, "/login/oauth/access_token"):
		return common.ServeRecorded(req, f.tokens.HandleToken), nil
	case req.Method == http.MethodPost && strings.HasPrefix(req.URL.Path, "/repos/") && strings.HasSuffix(req.URL.Path, "/pulls"):
		return common.ServeRecorded(req, func(w http.ResponseWriter, r *http.Request) {
			if !f.tokens.Authorized(r) {
				common.WriteJSON(w, http.StatusUnauthorized, map[string]any{"message": "Bad credentials"})
				return
			}
			pull := submittedPull{path: r.URL.Path, authorization: r.Header.Get("Authorization")}
			if err := json.NewDecoder(r.Body).Decode(&pull.body); err != nil {
				common.WriteJSON(w, http.StatusBadRequest, map[string]any{"message": "Problems parsing JSON"})
				return
			}
			f.mu.Lock()
			f.pulls = append(f.pulls, pull)
			number := len(f.pulls)
			f.mu.Unlock()
			repoPath := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/repos/"), "/pulls")
			common.WriteJSON(w, http.StatusCreated, map[string]any{
				"number":   number,
				"html_url": fmt.Sprintf("https://github.com/%s/pull/%d", repoPath, number),
			})
		}), nil
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
	helper, _ := githubHelperWithMock(t)
	return helper
}

func githubHelperWithMock(t *testing.T) (*common.ProvisioningTestHelper, *mockGithub) {
	t.Helper()
	mock := &mockGithub{tokens: oauthsuite.NewMockTokens(), base: http.DefaultTransport}
	http.DefaultTransport = mock
	t.Cleanup(func() { http.DefaultTransport = mock.base })

	helper := env.GetCleanHelper(t).ProvisioningTestHelper
	helper.GetEnv().GithubRepoFactory.Client = &http.Client{Transport: mock}
	return helper, mock
}
