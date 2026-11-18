package datasourceproxy

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasourceproxy/proxymetrics"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDataProxy(t *testing.T) {
	t.Run("extractProxyPath", func(t *testing.T) {
		testCases := []struct {
			originalRawPath string
			exp             string
		}{
			{
				"/api/datasources/proxy/1",
				"",
			},
			{
				"/api/datasources/proxy/1/some/thing",
				"some/thing",
			},
			{
				"/api/datasources/proxy/54/api/services/afsd%2Fafsd/operations",
				"api/services/afsd%2Fafsd/operations",
			},
			{
				"/api/datasources/proxy/uid/26MI0wZ7k",
				"",
			},
			{
				"/api/datasources/proxy/uid/26MI0wZ7k/some/thing",
				"some/thing",
			},
			{
				"/api/datasources/proxy/uid/pUWo-no4k/search",
				"search",
			},
			{
				"/api/datasources/proxy/uid/pUWo_no4k/search",
				"search",
			},
			{
				"/api/datasources/proxy/uid/26MI0wZ7k/api/services/afsd%2Fafsd/operations",
				"api/services/afsd%2Fafsd/operations",
			},
			{
				"/api/datasources/proxy/uid/26MI0wZ7k/api/services/afsd%2Fafsd/operations/",
				"api/services/afsd%2Fafsd/operations/",
			},
		}
		for _, tc := range testCases {
			t.Run("Given raw path, should extract expected proxy path", func(t *testing.T) {
				assert.Equal(t, tc.exp, extractProxyPath(tc.originalRawPath))
			})
		}
	})
}

// Tests request to datasource proxy service
func TestDatasourceProxy_proxyDatasourceRequest(t *testing.T) {
	tcs := []struct {
		name  string
		dsURL string
	}{
		{
			name:  "Empty datasource URL will return a 400 HTTP status code",
			dsURL: "",
		},
		{
			name:  "Invalid datasource URL will return a 400 HTTP status code",
			dsURL: "://host/path",
		},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			pluginID := datasources.DS_PROMETHEUS

			pluginStore := &pluginstore.FakePluginStore{PluginList: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: pluginID}},
			}}

			reg := prometheus.NewPedanticRegistry()
			p := DataSourceProxyService{
				DataSourceRequestValidator: &fakeDataSourceRequestValidator{},
				pluginStore:                pluginStore,
				metrics:                    proxymetrics.New(reg, proxymetrics.VariantLegacy),
			}

			responseRecorder := httptest.NewRecorder()
			c := &contextmodel.ReqContext{
				Context: &web.Context{
					Req:  &http.Request{Method: http.MethodGet, URL: &url.URL{}},
					Resp: web.NewResponseWriter("GET", responseRecorder),
				},
				Logger: log.NewNopLogger(),
			}

			obs := p.observe(c)
			p.proxyDatasourceRequest(c, &datasources.DataSource{
				Type: pluginID,
				URL:  tc.dsURL,
			}, obs)
			obs.finish()

			resp := responseRecorder.Result()
			body := resp.Body

			b, err := io.ReadAll(body)
			require.NoError(t, err)
			require.NoError(t, body.Close())

			jsonBody := make(map[string]string)
			err = json.Unmarshal(b, &jsonBody)
			require.NoError(t, err)

			require.Equal(t, http.StatusBadRequest, resp.StatusCode)
			require.Equal(t, fmt.Sprintf("Invalid data source URL: %q", tc.dsURL), jsonBody["message"])

			require.Equal(t, map[string]string{
				"variant":       proxymetrics.VariantLegacy,
				"plugin_id":     pluginID,
				"status_code":   "400",
				"status_source": proxymetrics.SourceServer,
			}, onlyRequestSeries(t, reg))
		})
	}
}

func onlyRequestSeries(t *testing.T, reg *prometheus.Registry) map[string]string {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	for _, f := range families {
		if f.GetName() != "grafana_datasource_proxy_requests_total" {
			continue
		}
		require.Len(t, f.GetMetric(), 1)
		labels := map[string]string{}
		for _, l := range f.GetMetric()[0].GetLabel() {
			labels[l.GetName()] = l.GetValue()
		}
		return labels
	}
	t.Fatal("grafana_datasource_proxy_requests_total was not recorded")
	return nil
}

type fakeDataSourceRequestValidator struct{}

func (rv *fakeDataSourceRequestValidator) Validate(_ string, _ map[string]any, _ *http.Request) error {
	return nil
}
