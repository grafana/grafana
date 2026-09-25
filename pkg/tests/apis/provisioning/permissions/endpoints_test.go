package permissions

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/org"
	pt "github.com/grafana/grafana/pkg/tests/apis/provisioning/permissions/testutil"
)

// Learning which APIs exist does not grant access to their data: an ungranted None
// user can discover the provisioning API but cannot list repositories.
func TestIntegrationProvisioning_NoneDiscovery(t *testing.T) {
	h := sharedHelper(t)
	u := pt.None(t, h)
	for _, path := range []string{"/apis", "/apis/provisioning.grafana.app", "/apis/provisioning.grafana.app/v0alpha1", "/apis/provisioning.grafana.app/v1beta1"} {
		pt.Request(t, u, "GET", path, nil).Require(t, 200)
	}
	pt.Do(t, u, "GET", "v0alpha1", "repositories", nil).Require(t, 403)
}

// Settings and statistics have independent grants. Repository summaries in settings
// must not be mistaken for permission to read the repository objects themselves.
func TestIntegrationProvisioning_NoneSettingsAndStats(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.LocalRepo(t, h, "folder")
	for _, version := range pt.Versions {
		for _, endpoint := range []string{"settings", "stats"} {
			for _, grant := range []string{"none", "settings", "stats"} {
				t.Run(version+"/"+endpoint+"/"+grant, func(t *testing.T) {
					var actions []string
					if grant != "none" {
						actions = []string{"provisioning." + grant + ":read"}
					}
					u := pt.None(t, h, pt.Actions(actions...)...)
					rsp := pt.Do(t, u, "GET", version, endpoint, nil)
					if grant != endpoint {
						rsp.Require(t, 403)
						return
					}
					rsp.Require(t, 200)
					if endpoint == "settings" {
						require.Contains(t, string(rsp.Body), repo)
					}
					pt.Do(t, u, "GET", version, "repositories/"+repo, nil).Require(t, 403)
				})
			}
		}
	}
}

// Repository inspection uses the write grant even for GET requests. Read-only access
// must not unlock resource inspection, status, or configuration testing.
func TestIntegrationProvisioning_NoneRepositoryInspection(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.LocalRepo(t, h, "folder")
	for _, version := range pt.Versions {
		for _, grant := range []string{"none", "read", "write"} {
			t.Run(version+"/"+grant, func(t *testing.T) {
				var actions []string
				if grant != "none" {
					actions = []string{"provisioning.repositories:" + grant}
				}
				u := pt.None(t, h, pt.Actions(actions...)...)
				for _, endpoint := range []string{"resources", "status", "test"} {
					method := "GET"
					var body any
					if endpoint == "test" {
						method = "POST"
						body = pt.Repository(repo, h.ProvisioningPath, version)
					}
					rsp := pt.Do(t, u, method, version, "repositories/"+repo+"/"+endpoint, body)
					if grant == "write" {
						rsp.Require(t, 200)
					} else {
						rsp.Require(t, 403)
					}
				}
			})
		}
	}
}

type oauthTransport struct {
	base      http.RoundTripper
	exchanges atomic.Int32
}

func (f *oauthTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	var body string
	switch {
	case r.URL.Host == "github.com" && strings.HasSuffix(r.URL.Path, "/login/oauth/access_token"):
		f.exchanges.Add(1)
		body = `{"access_token":"none-audit-token","token_type":"bearer","scope":"repo"}`
	case r.URL.Host == "api.github.com" && r.URL.Path == "/user/repos":
		if !strings.Contains(r.Header.Get("Authorization"), "none-audit-token") {
			return &http.Response{StatusCode: 401, Body: io.NopCloser(strings.NewReader(`{"message":"incorrect token"}`)), Header: http.Header{}, Request: r}, nil
		}
		body = `[{"name":"visible","owner":{"login":"fixture"},"html_url":"https://github.com/fixture/visible"}]`
	default:
		return f.base.RoundTrip(r)
	}
	return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{"Content-Type": []string{"application/json"}}, Request: r}, nil
}

// OAuth exchange mutates credentials and requires write; remote repository listing
// requires read. Denied exchanges must not contact the provider or store a token.
func TestIntegrationProvisioning_NoneConnectionSubresources(t *testing.T) {
	transport := &oauthTransport{base: http.DefaultTransport}
	http.DefaultTransport = transport
	t.Cleanup(func() { http.DefaultTransport = transport.base })
	h := sharedHelper(t)
	h.GetEnv().GithubRepoFactory.Client = &http.Client{Transport: transport}
	for _, version := range pt.Versions {
		for _, grant := range []string{"none", "read", "write"} {
			t.Run(version+"/"+grant, func(t *testing.T) {
				name := pt.Name()
				pt.Do(t, h.Org1.Admin, "POST", version, "connections", pt.Connection(name, version)).Require(t, 201)
				var actions []string
				if grant != "none" {
					actions = []string{"provisioning.connections:" + grant}
				}
				u := pt.None(t, h, pt.Actions(actions...)...)
				body := map[string]any{"spec": map[string]any{"code": "fixture-code", "redirectURI": "https://grafana.example.com/callback"}}
				before := transport.exchanges.Load()
				rsp := pt.Do(t, u, "POST", version, "connections/"+name+"/authorize", body)
				if grant == "write" {
					rsp.Require(t, 200)
					require.Equal(t, before+1, transport.exchanges.Load())
				} else {
					rsp.Require(t, 403)
					require.Equal(t, before, transport.exchanges.Load())
					unchanged := pt.Do(t, h.Org1.Admin, "GET", version, "connections/"+name, nil).Require(t, 200).Object(t)
					require.NotContains(t, unchanged["secure"].(map[string]any), "token")
					pt.Do(t, h.Org1.Admin, "POST", version, "connections/"+name+"/authorize", body).Require(t, 200)
				}
				stored := pt.Do(t, h.Org1.Admin, "GET", version, "connections/"+name, nil).Require(t, 200)
				require.NotContains(t, string(stored.Body), "none-audit-token")
				require.Contains(t, stored.Object(t)["secure"].(map[string]any), "token")
				rsp = pt.Do(t, u, "GET", version, "connections/"+name+"/repositories", nil)
				if grant == "read" {
					rsp.Require(t, 200)
					require.Contains(t, string(rsp.Body), "fixture/visible")
				} else {
					rsp.Require(t, 403)
				}
			})
		}
	}
}

// Provisioning read grants are unscoped within an organization. The same None user
// can read two independently created repositories and connections with those grants.
func TestIntegrationProvisioning_NoneProvisioningGrantBreadth(t *testing.T) {
	h := sharedHelper(t)
	u := pt.None(t, h, pt.Actions("provisioning.repositories:read", "provisioning.connections:read")...)
	for i := 0; i < 2; i++ {
		name := pt.Name()
		repo := pt.Repository(name, fmt.Sprintf("%s/%s", h.ProvisioningPath, name), "v0alpha1")
		pt.Do(t, h.Org1.Admin, "POST", "v0alpha1", "repositories", repo).Require(t, 201)
		pt.Do(t, h.Org1.Admin, "POST", "v0alpha1", "connections", pt.Connection(name, "v0alpha1")).Require(t, 201)
		for _, version := range pt.Versions {
			for _, resource := range []string{"repositories", "connections"} {
				pt.Do(t, u, "GET", version, resource+"/"+name, nil).Require(t, 200)
			}
		}
	}
}

// Organization-wide grants must stop at the namespace boundary. Seed an existing
// repository in another organization so a missing resource cannot explain rejection.
func TestIntegrationProvisioning_NoneNamespaceIsolation(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.LocalRepo(t, h, "folder")
	u := pt.None(t, h, pt.Actions("provisioning.repositories:read", "provisioning.connections:read", "provisioning.jobs:read", "provisioning.settings:read", "provisioning.stats:read", "dashboards:read", "folders:read")...)
	otherOrg := h.CreateOrg("PermissionOtherOrg")
	otherNamespace := h.Namespacer(otherOrg)
	otherAdmin := h.CreateUser(pt.Name(), "PermissionOtherOrg", org.RoleAdmin, nil)
	otherPath := func(version, endpoint string) string {
		return strings.Replace(pt.Path(version, endpoint), "/namespaces/default/", "/namespaces/"+otherNamespace+"/", 1)
	}
	pt.Request(t, otherAdmin, "POST", otherPath("v0alpha1", "repositories"), pt.Repository(repo, h.ProvisioningPath, "v0alpha1")).Require(t, 201)
	pt.Request(t, otherAdmin, "PATCH", otherPath("v0alpha1", "repositories/"+repo+"/status"), map[string]any{"status": map[string]any{"health": map[string]any{"healthy": true}}}).Require(t, 200)
	for _, version := range pt.Versions {
		for _, endpoint := range []string{"repositories", "connections", "jobs", "settings", "stats", "repositories/" + repo + "/files/"} {
			path := otherPath(version, endpoint)
			pt.Request(t, u, "GET", path, nil).Require(t, 403)
		}
	}
}
