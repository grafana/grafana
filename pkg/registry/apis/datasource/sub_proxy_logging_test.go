package datasource

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	gokitlog "github.com/go-kit/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
	krequest "k8s.io/apiserver/pkg/endpoints/request"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
)

func TestSubProxyUsageLogging(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
		absent bool
		denied bool
		path   string
	}{
		{name: "successful request", status: http.StatusNoContent},
		{name: "upstream failure", status: http.StatusServiceUnavailable},
		{name: "missing datasource", status: http.StatusNotFound, absent: true},
		{name: "route authorization denied", status: http.StatusForbidden, denied: true},
		{name: "unmatched route retains forwarding", status: http.StatusNoContent, path: "undeclared"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var logs bytes.Buffer
			previous := proxyUsageLogger
			proxyUsageLogger = log.NewNopLogger()
			proxyUsageLogger.Swap(gokitlog.NewJSONLogger(&logs))
			t.Cleanup(func() { proxyUsageLogger = previous })

			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				body := new(bytes.Buffer)
				_, err := body.ReadFrom(req.Body)
				require.NoError(t, err)
				require.Equal(t, "private-request-body", body.String())
				w.WriteHeader(tc.status)
			}))
			t.Cleanup(upstream.Close)
			ds := &datasourceV0.DataSource{}
			ds.Name = "ds-1"
			ds.Spec.SetURL(upstream.URL)
			provider := &proxyMockDatasourceProvider{ds: ds}
			provider.instanceSettings = &backend.DataSourceInstanceSettings{UID: ds.Name, Type: "test", URL: upstream.URL, JSONData: []byte(`{}`)}
			if tc.absent {
				provider.dsErr = datasources.ErrDataSourceNotFound
			}
			builder := newProxyTestBuilder(provider)
			if tc.denied {
				builder.pluginJSON.Routes = []*plugins.Route{{Path: "query", Method: "GET", ReqRole: org.RoleAdmin}}
			}
			storage := &subProxyREST{builder: builder, transports: newProxyTransportCache()}
			t.Cleanup(storage.Destroy)
			ctx := krequest.WithNamespace(proxyTestContext(), "stacks-1")
			handler, err := storage.Connect(ctx, ds.Name, nil, &resourceMockResponder{})
			require.NoError(t, err)
			proxyPath := tc.path
			if proxyPath == "" {
				proxyPath = "query"
			}
			req := httptest.NewRequest(http.MethodGet,
				"/apis/test.datasource.grafana.app/v0alpha1/namespaces/stacks-1/datasources/ds-1/proxy/"+proxyPath+"?token=private-query-token",
				strings.NewReader("private-request-body"))
			req.Header.Set("Authorization", "Bearer private-auth-token")
			req.Header.Set("Cookie", "session=private-session")
			req.Header.Set("Referer", "https://example.com/?token=private-referer")
			req.Header.Set("X-Panel-Id", "42")
			handler.ServeHTTP(httptest.NewRecorder(), req)

			var entry map[string]any
			require.NoError(t, json.Unmarshal(logs.Bytes(), &entry), "exactly one usage record is expected")
			require.Equal(t, "stacks-1", entry["namespace"])
			require.Equal(t, "ds-1", entry["datasource_uid"])
			require.Equal(t, "test", entry["datasource_type"])
			require.Equal(t, "admin", entry["requester_login"])
			require.Equal(t, float64(1), entry["org_id"])
			require.Equal(t, proxyPath, entry["proxy_path"])
			require.Equal(t, req.URL.EscapedPath(), entry["path"])
			require.Equal(t, "GET", entry["method"])
			require.Equal(t, float64(tc.status), entry["status"])
			require.Equal(t, "42", entry["client_panel_id"])
			require.Contains(t, entry, "requester_uid")
			require.Contains(t, entry, "requester_type")
			require.Contains(t, entry, "duration_ms")
			require.NotContains(t, logs.String(), "private-")
		})
	}
}
