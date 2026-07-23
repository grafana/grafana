package githuboauth

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
	oauth2github "golang.org/x/oauth2/github"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
)

func TestProvider_ListRepositories(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/user/repos", r.URL.Path)
		require.Equal(t, "Bearer test-token", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Query().Get("page") {
		case "", "1":
			w.Header().Set("Link", `<https://api.github.com/user/repos?page=2>; rel="next"`)
			_, _ = fmt.Fprint(w, `[{"name":"repo-one","html_url":"https://github.com/my-org/repo-one","owner":{"login":"my-org"}}]`)
		default:
			_, _ = fmt.Fprint(w, `[{"name":"repo-two","html_url":"https://github.com/my-org/repo-two","owner":{"login":"my-org"}}]`)
		}
	}))
	defer srv.Close()

	p := &Provider{}
	repos, err := p.ListRepositories(testContext(t, srv), "test-token")
	require.NoError(t, err)
	assert.Equal(t, []provisioning.ExternalRepository{
		{Name: "repo-one", Owner: "my-org", URL: "https://github.com/my-org/repo-one"},
		{Name: "repo-two", Owner: "my-org", URL: "https://github.com/my-org/repo-two"},
	}, repos)
}

func TestProvider_ListRepositories_AuthErrors(t *testing.T) {
	for _, status := range []int{http.StatusUnauthorized, http.StatusForbidden} {
		t.Run(fmt.Sprint(status), func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(status)
			}))
			defer srv.Close()

			p := &Provider{}
			_, err := p.ListRepositories(testContext(t, srv), "bad-token")
			require.ErrorIs(t, err, connection.ErrAuthentication)
		})
	}
}

func TestProvider_Endpoint(t *testing.T) {
	assert.Equal(t, oauth2github.Endpoint, (&Provider{}).Endpoint())
}

func testContext(t *testing.T, srv *httptest.Server) context.Context {
	srvURL, err := url.Parse(srv.URL)
	require.NoError(t, err)
	return context.WithValue(t.Context(), oauth2.HTTPClient, &http.Client{
		Transport: rewriteTransport{url: srvURL},
	})
}

type rewriteTransport struct {
	url *url.URL
}

func (t rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req.URL.Scheme = t.url.Scheme
	req.URL.Host = t.url.Host
	return http.DefaultTransport.RoundTrip(req)
}
