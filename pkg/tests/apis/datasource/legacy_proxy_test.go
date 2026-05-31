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
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// legacyProxyCapturedRequest records what the upstream datasource received so
// the test can assert how the proxy rewrote the request.
type legacyProxyCapturedRequest struct {
	method    string
	path      string
	rawQuery  string
	auth      string
	dsAuth    string
	grafanaID string
	userAgent string
	cookies   map[string]string
}

// TestIntegrationLegacyDatasourceProxy exercises the legacy datasource proxy
// (/api/datasources/proxy/uid/<uid>/...). It verifies the request rewriting done
// by pluginproxy.DataSourceProxy: path/query forwarding, basic auth injection,
// identity forwarding, cookie filtering, the X-DS-Authorization override, the
// 401->400 conversion, datasource method allow-listing and plugin route RBAC.
func TestIntegrationLegacyDatasourceProxy(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const (
		uid           = "prom-test"
		basicAuthUser = "promuser"
		basicAuthPass = "promsecret"
	)

	// Stand in for a Prometheus server, recording what it last received.
	var mu sync.Mutex
	var last *legacyProxyCapturedRequest
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		c := &legacyProxyCapturedRequest{
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

	upstreamGot := func() *legacyProxyCapturedRequest {
		mu.Lock()
		defer mu.Unlock()
		return last
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})

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

	proxyPath := func(sub string) string {
		return "/api/datasources/proxy/uid/" + uid + "/" + sub
	}

	// doProxy clears the recorded upstream request, sends a request through the
	// proxy and returns the status code and body.
	doProxy := func(user apis.User, method, path string, headers map[string]string) (int, []byte) {
		mu.Lock()
		last = nil
		mu.Unlock()
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:    user,
			Method:  method,
			Path:    path,
			Headers: headers,
		}, nil)
		return raw.Response.StatusCode, raw.Body
	}

	t.Run("forwards path, query, basic auth, identity and filtered cookies", func(t *testing.T) {
		status, body := doProxy(helper.Org1.Admin, http.MethodGet, proxyPath("api/v1/labels?match%5B%5D=up"), map[string]string{
			"Cookie": "kept=1; dropped=2; prefXY=3",
		})
		require.Equal(t, http.StatusOK, status, "body: %s", body)

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

	t.Run("honours the X-DS-Authorization override", func(t *testing.T) {
		status, body := doProxy(helper.Org1.Admin, http.MethodGet, proxyPath("api/v1/labels"), map[string]string{
			"X-DS-Authorization": "Bearer ds-token",
		})
		require.Equal(t, http.StatusOK, status, "body: %s", body)

		got := upstreamGot()
		require.NotNil(t, got)
		require.Equal(t, "Bearer ds-token", got.auth, "X-DS-Authorization should replace the Authorization header")
		require.Empty(t, got.dsAuth, "X-DS-Authorization should be stripped before forwarding")
	})

	t.Run("converts an upstream 401 to 400", func(t *testing.T) {
		status, _ := doProxy(helper.Org1.Admin, http.MethodGet, proxyPath("api/v1/unauthorized"), nil)
		require.Equal(t, http.StatusBadRequest, status, "401 should be converted to 400")
	})

	t.Run("rejects non-allow-listed methods for Prometheus", func(t *testing.T) {
		status, _ := doProxy(helper.Org1.Admin, http.MethodDelete, proxyPath("api/v1/labels"), nil)
		require.Equal(t, http.StatusForbidden, status)
		require.Nil(t, upstreamGot(), "blocked request must not reach the upstream")
	})

	t.Run("enforces plugin route RBAC", func(t *testing.T) {
		// A viewer with the query permission may reach the proxy, but the
		// Prometheus admin (rules) routes require the Editor role.
		viewer := helper.CreateUser("legacy-proxy-route-viewer", apis.Org1, org.RoleViewer, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{datasources.ActionQuery},
				Resource:          datasources.ScopeRoot,
				ResourceID:        uid,
				ResourceAttribute: "uid",
			},
		})

		// DELETE /rules requires Editor -> denied for the viewer.
		status, _ := doProxy(viewer, http.MethodDelete, proxyPath("rules"), nil)
		require.Equal(t, http.StatusForbidden, status)
		require.Nil(t, upstreamGot(), "RBAC-denied request must not reach the upstream")

		// GET /rules only requires Viewer -> allowed.
		status, body := doProxy(viewer, http.MethodGet, proxyPath("rules"), nil)
		require.Equal(t, http.StatusOK, status, "body: %s", body)
		require.NotNil(t, upstreamGot())
	})

	t.Run("denies cross-org access", func(t *testing.T) {
		status, _ := doProxy(helper.OrgB.Admin, http.MethodGet, proxyPath("api/v1/labels"), nil)
		require.NotEqual(t, http.StatusOK, status)
		require.Nil(t, upstreamGot(), "cross-org request must not reach the upstream")
	})
}
