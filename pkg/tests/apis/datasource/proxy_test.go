package datasource

import (
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationDatasourceProxy verifies that the datasource frontend proxy
// forwards requests to the upstream datasource through both the legacy
// (/api/datasources/proxy/...) and the apiserver (.../datasources/<uid>/proxy/...)
// routes. Both paths share the same pluginproxy.DataSourceProxy machinery.
func TestIntegrationDatasourceProxy(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Stand in for a Prometheus server. It records the requests it receives so
	// the test can confirm the proxy forwarded the correct path.
	var mu sync.Mutex
	received := map[string]bool{}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		mu.Lock()
		received[req.Method+" "+req.URL.Path] = true
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"status":"success","data":{"labels":["__name__"]}}`)
	}))
	defer upstream.Close()

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // start the datasource api servers
			featuremgmt.FlagDatasourceUseNewCRUDAPIs,             // register the datasource api groups
		},
	})

	const uid = "prom-test"
	ds := helper.CreateDS(&datasources.AddDataSourceCommand{
		OrgID:  helper.Org1.OrgID,
		Name:   "prom-test",
		UID:    uid,
		Type:   datasources.DS_PROMETHEUS,
		Access: datasources.DS_ACCESS_PROXY,
		URL:    upstream.URL,
	})
	require.Equal(t, uid, ds.UID)

	// GET to a path with no matching plugin route still proxies for Prometheus
	// (only non-allow-listed DELETE/PUT/POST are rejected), which keeps the test
	// independent of route RBAC.
	const upstreamRequest = "GET /api/v1/labels"

	resetReceived := func() {
		mu.Lock()
		received = map[string]bool{}
		mu.Unlock()
	}
	wasReceived := func() bool {
		mu.Lock()
		defer mu.Unlock()
		return received[upstreamRequest]
	}

	t.Run("legacy proxy forwards to the datasource", func(t *testing.T) {
		resetReceived()
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   "/api/datasources/proxy/uid/" + uid + "/api/v1/labels",
		}, nil)
		require.NotNil(t, raw.Response)
		require.Equal(t, http.StatusOK, raw.Response.StatusCode, "body: %s", string(raw.Body))
		require.True(t, wasReceived(), "upstream did not receive %q", upstreamRequest)
	})

	t.Run("apiserver proxy forwards to the datasource", func(t *testing.T) {
		resetReceived()
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/" + uid + "/proxy/api/v1/labels",
		}, nil)
		require.NotNil(t, raw.Response)
		require.Equal(t, http.StatusOK, raw.Response.StatusCode, "body: %s", string(raw.Body))
		require.True(t, wasReceived(), "upstream did not receive %q", upstreamRequest)
	})

	t.Run("apiserver proxy denies cross-org access", func(t *testing.T) {
		resetReceived()
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.OrgB.Admin,
			Method: http.MethodGet,
			Path:   "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/" + uid + "/proxy/api/v1/labels",
		}, nil)
		require.NotNil(t, raw.Response)
		require.NotEqual(t, http.StatusOK, raw.Response.StatusCode)
		require.False(t, wasReceived(), "cross-org request should not reach the upstream")
	})
}
