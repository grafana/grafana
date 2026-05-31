package datasource

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// capturedRequest records what the upstream datasource received so the test can
// assert how the proxy rewrote the request.
type capturedRequest struct {
	method    string
	path      string
	rawQuery  string
	auth      string
	dsAuth    string
	grafanaID string
	userAgent string
	cookies   map[string]string
}

// TestIntegrationDatasourceProxy exercises the datasource frontend proxy through
// both the legacy (/api/datasources/proxy/...) and the apiserver
// (.../datasources/<uid>/proxy/...) routes. Both share the same
// pluginproxy.DataSourceProxy machinery, so the core behaviours are asserted on
// both transports, while transport-specific edge cases are asserted once.
func TestIntegrationDatasourceProxy(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const (
		basicAuthUser = "promuser"
		basicAuthPass = "promsecret"
	)

	// Stand in for a Prometheus server, recording what it receives.
	var mu sync.Mutex
	var last *capturedRequest
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		c := &capturedRequest{
			method:    req.Method,
			path:      req.URL.Path,
			rawQuery:  req.URL.RawQuery,
			auth:      req.Header.Get("Authorization"),
			dsAuth:    req.Header.Get("X-DS-Authorization"),
			grafanaID: req.Header.Get(proxyutil.IDHeaderName),
			userAgent: req.Header.Get("User-Agent"),
			cookies:   map[string]string{},
		}
		for _, ck := range req.Cookies() {
			c.cookies[ck.Name] = ck.Value
		}
		mu.Lock()
		last = c
		mu.Unlock()

		// Special path used to exercise the 401 -> 400 conversion.
		if strings.HasSuffix(req.URL.Path, "/unauthorized") {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"status":"success","data":{"labels":["__name__"]}}`)
	}))
	defer upstream.Close()

	reset := func() {
		mu.Lock()
		last = nil
		mu.Unlock()
	}
	upstreamGot := func() *capturedRequest {
		mu.Lock()
		defer mu.Unlock()
		return last
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // start the datasource api servers
			featuremgmt.FlagDatasourceUseNewCRUDAPIs,             // register the datasource api groups
		},
	})

	const uid = "prom-test"
	ds := helper.CreateDS(&datasources.AddDataSourceCommand{
		OrgID:         helper.Org1.OrgID,
		Name:          "prom-test",
		UID:           uid,
		Type:          datasources.DS_PROMETHEUS,
		Access:        datasources.DS_ACCESS_PROXY,
		URL:           upstream.URL,
		BasicAuth:     true,
		BasicAuthUser: basicAuthUser,
		SecureJsonData: map[string]string{
			"basicAuthPassword": basicAuthPass,
		},
		// keepCookies keeps "kept" (exact) and anything matching "pref" (prefix).
		JsonData: simplejson.NewFromAny(map[string]any{
			"keepCookies": []any{"kept", "pref[]"},
		}),
	})
	require.Equal(t, uid, ds.UID)

	legacyPath := func(sub string) string {
		return "/api/datasources/proxy/uid/" + uid + "/" + sub
	}
	apiserverPath := func(sub string) string {
		return "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/" + uid + "/proxy/" + sub
	}

	transports := []struct {
		name string
		path func(sub string) string
	}{
		{"legacy", legacyPath},
		{"apiserver", apiserverPath},
	}

	// Core behaviours, asserted on both transports.
	for _, transport := range transports {
		t.Run(transport.name+" forwards path, query, basic auth, identity and filtered cookies", func(t *testing.T) {
			reset()
			raw := apis.DoRequest[any](helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: http.MethodGet,
				Path:   transport.path("api/v1/labels?match%5B%5D=up"),
				Headers: map[string]string{
					"Cookie": "kept=1; dropped=2; prefXY=3",
				},
			}, nil)
			require.NotNil(t, raw.Response)
			require.Equal(t, http.StatusOK, raw.Response.StatusCode, "body: %s", string(raw.Body))

			got := upstreamGot()
			require.NotNil(t, got, "upstream did not receive the request")
			require.Equal(t, http.MethodGet, got.method)
			require.Equal(t, "/api/v1/labels", got.path, "proxy path should be forwarded")
			require.Equal(t, "match%5B%5D=up", got.rawQuery, "query string should be preserved")

			// Basic auth from the datasource config replaces any inbound auth.
			require.Equal(t, util.GetBasicAuthHeader(basicAuthUser, basicAuthPass), got.auth)

			require.True(t, strings.HasPrefix(got.userAgent, "Grafana/"), "got user-agent %q", got.userAgent)

			// The signed-in identity is forwarded to the datasource.
			require.NotEmpty(t, got.grafanaID, "X-Grafana-Id should be forwarded")

			// keepCookies filtering: exact + prefix matches are kept, others dropped.
			require.Equal(t, "1", got.cookies["kept"])
			require.Equal(t, "3", got.cookies["prefXY"])
			require.NotContains(t, got.cookies, "dropped")
		})

		t.Run(transport.name+" honours the X-DS-Authorization override", func(t *testing.T) {
			reset()
			raw := apis.DoRequest[any](helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: http.MethodGet,
				Path:   transport.path("api/v1/labels"),
				Headers: map[string]string{
					"X-DS-Authorization": "Bearer ds-token",
				},
			}, nil)
			require.Equal(t, http.StatusOK, raw.Response.StatusCode, "body: %s", string(raw.Body))

			got := upstreamGot()
			require.NotNil(t, got)
			require.Equal(t, "Bearer ds-token", got.auth, "X-DS-Authorization should replace the Authorization header")
			require.Empty(t, got.dsAuth, "X-DS-Authorization should be stripped before forwarding")
		})

		t.Run(transport.name+" converts an upstream 401 to 400", func(t *testing.T) {
			reset()
			raw := apis.DoRequest[any](helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: http.MethodGet,
				Path:   transport.path("api/v1/unauthorized"),
			}, nil)
			require.NotNil(t, raw.Response)
			require.Equal(t, http.StatusBadRequest, raw.Response.StatusCode, "401 should be converted to 400")
		})
	}

	// Transport-specific edge cases (shared machinery, asserted once).
	t.Run("apiserver rejects non-allow-listed methods for Prometheus", func(t *testing.T) {
		reset()
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   apiserverPath("api/v1/labels"),
		}, nil)
		require.NotNil(t, raw.Response)
		require.Equal(t, http.StatusForbidden, raw.Response.StatusCode)
		require.Nil(t, upstreamGot(), "blocked request must not reach the upstream")
	})

	t.Run("apiserver enforces plugin route RBAC", func(t *testing.T) {
		// A viewer with the query permission passes the apiserver authorizer, but
		// the Prometheus admin (rules) routes require the Editor role.
		viewer := helper.CreateUser("proxy-route-viewer", apis.Org1, org.RoleViewer, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{datasources.ActionQuery},
				Resource:          datasources.ScopeRoot,
				ResourceID:        uid,
				ResourceAttribute: "uid",
			},
		})

		reset()
		denied := apis.DoRequest[any](helper, apis.RequestParams{
			User:   viewer,
			Method: http.MethodDelete,
			Path:   apiserverPath("rules"), // DELETE /rules requires Editor
		}, nil)
		require.NotNil(t, denied.Response)
		require.Equal(t, http.StatusForbidden, denied.Response.StatusCode)
		require.Nil(t, upstreamGot(), "RBAC-denied request must not reach the upstream")

		// The same viewer may still use a route that only requires the Viewer role.
		reset()
		allowed := apis.DoRequest[any](helper, apis.RequestParams{
			User:   viewer,
			Method: http.MethodGet,
			Path:   apiserverPath("rules"), // GET /rules requires Viewer
		}, nil)
		require.Equal(t, http.StatusOK, allowed.Response.StatusCode, "body: %s", string(allowed.Body))
		require.NotNil(t, upstreamGot())
	})

	t.Run("apiserver returns 404 for an unknown datasource", func(t *testing.T) {
		reset()
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/does-not-exist/proxy/api/v1/labels",
		}, nil)
		require.NotNil(t, raw.Response)
		require.Equal(t, http.StatusNotFound, raw.Response.StatusCode)
		require.Nil(t, upstreamGot())
	})

	t.Run("apiserver denies cross-org access", func(t *testing.T) {
		reset()
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.OrgB.Admin,
			Method: http.MethodGet,
			Path:   apiserverPath("api/v1/labels"),
		}, nil)
		require.NotNil(t, raw.Response)
		require.NotEqual(t, http.StatusOK, raw.Response.StatusCode)
		require.Nil(t, upstreamGot(), "cross-org request must not reach the upstream")
	})
}
