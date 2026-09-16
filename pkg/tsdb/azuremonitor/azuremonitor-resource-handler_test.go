package azuremonitor

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/loganalytics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/metrics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"

	"github.com/stretchr/testify/require"
)

func Test_parseResourcePath(t *testing.T) {
	tests := []struct {
		name           string
		original       string
		expectedTarget string
		Err            require.ErrorAssertionFunc
	}{
		{
			"Path with a subscription",
			"/azuremonitor/subscriptions/44693801",
			"/subscriptions/44693801",
			require.NoError,
		},
		{
			"Malformed path",
			"/subscriptions?44693801",
			"",
			require.Error,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target, err := getTarget(tt.original)
			if target != tt.expectedTarget {
				t.Errorf("Unexpected target %s expecting %s", target, tt.expectedTarget)
			}
			tt.Err(t, err)
		})
	}
}

func Test_proxyRequest(t *testing.T) {
	tests := []struct {
		name string
	}{
		{"forwards headers and body"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Add("foo", "bar")
				_, err := w.Write([]byte("result"))
				if err != nil {
					t.Fatal(err)
				}
			}))
			req, err := http.NewRequest(http.MethodGet, srv.URL, nil)
			if err != nil {
				t.Error(err)
			}
			rw := httptest.NewRecorder()
			proxy := httpServiceProxy{}
			res, err := proxy.Do(rw, req, srv.Client())
			if err != nil {
				t.Error(err)
			}
			if res.Header().Get("foo") != "bar" {
				t.Errorf("Unexpected headers: %v", res.Header())
			}
			result := rw.Result()
			body, err := io.ReadAll(result.Body)
			if err != nil {
				t.Error(err)
			}
			err = result.Body.Close()
			if err != nil {
				t.Error(err)
			}
			if string(body) != "result" {
				t.Errorf("Unexpected body: %v", string(body))
			}
		})
	}
}

type fakeProxy struct {
	requestedURL string
}

func (s *fakeProxy) Do(rw http.ResponseWriter, req *http.Request, cli *http.Client) (http.ResponseWriter, error) {
	s.requestedURL = req.URL.String()
	return nil, nil
}

func Test_handleResourceReq(t *testing.T) {
	proxy := &fakeProxy{}
	s := Service{
		im: &fakeInstance{
			services: map[string]types.DatasourceService{
				azureMonitor: {
					URL:        "https://management.azure.com",
					HTTPClient: &http.Client{},
					Logger:     log.DefaultLogger,
				},
			},
		},
		executors: map[string]azDatasourceExecutor{
			azureMonitor: &metrics.AzureMonitorDatasource{
				Proxy: proxy,
			},
		},
		logger: log.DefaultLogger,
	}
	rw := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodGet, "http://foo/azuremonitor/subscriptions/44693801/locations", nil)
	if err != nil {
		t.Fatalf("Unexpected error %v", err)
	}
	s.handleResourceReq(azureMonitor)(rw, req)
	expectedURL := "https://management.azure.com/subscriptions/44693801/locations"
	if proxy.requestedURL != expectedURL {
		t.Errorf("Unexpected result URL. Got %s, expecting %s", proxy.requestedURL, expectedURL)
	}
}

func Test_validateResourceRequest(t *testing.T) {
	tests := []struct {
		name           string
		subDataSource  string
		path           string
		method         string
		expectedStatus int
	}{
		{
			"allows listing subscriptions",
			azureMonitor,
			"/subscriptions",
			http.MethodGet,
			0,
		},
		{
			"allows listing locations",
			azureMonitor,
			"/subscriptions/44693801/locations",
			http.MethodGet,
			0,
		},
		{
			"allows metric definitions for a resource",
			azureMonitor,
			"/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm/providers/microsoft.insights/metricdefinitions",
			http.MethodGet,
			0,
		},
		{
			"allows metric namespaces at subscription scope",
			azureMonitor,
			"/subscriptions/44693801/providers/microsoft.insights/metricNamespaces",
			http.MethodGet,
			0,
		},
		{
			"allows metric values for a resource",
			azureMonitor,
			"/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm/providers/microsoft.insights/metrics",
			http.MethodGet,
			0,
		},
		{
			"allows the log analytics workspace table lookup",
			azureMonitor,
			"/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.OperationalInsights/workspaces/ws/tables/AzureActivity",
			http.MethodGet,
			0,
		},
		{
			"denies storage account key listing",
			azureMonitor,
			"/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/sa/listKeys",
			http.MethodPost,
			http.StatusForbidden,
		},
		{
			"denies arbitrary ARM resource reads",
			azureMonitor,
			"/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.KeyVault/vaults/kv/secrets",
			http.MethodGet,
			http.StatusForbidden,
		},
		{
			"denies writes to an otherwise allowed path",
			azureMonitor,
			"/subscriptions/44693801/locations",
			http.MethodPost,
			http.StatusMethodNotAllowed,
		},
		{
			"denies deletes",
			azureMonitor,
			"/subscriptions/44693801/resourceGroups/rg/providers/microsoft.insights/metricdefinitions",
			http.MethodDelete,
			http.StatusMethodNotAllowed,
		},
		{
			"denies path traversal",
			azureMonitor,
			"/subscriptions/44693801/locations/../../resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/sa/listKeys",
			http.MethodGet,
			http.StatusForbidden,
		},
		{
			"denies dot segments",
			azureMonitor,
			"/subscriptions/./locations",
			http.MethodGet,
			http.StatusForbidden,
		},
		{
			"denies empty segments",
			azureMonitor,
			"/subscriptions//locations",
			http.MethodGet,
			http.StatusForbidden,
		},
		{
			"allows log analytics queries",
			azureLogAnalytics,
			"/v1/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.OperationalInsights/workspaces/ws/query",
			http.MethodPost,
			0,
		},
		{
			"allows log analytics metadata",
			azureLogAnalytics,
			"/v1/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.OperationalInsights/workspaces/ws/metadata",
			http.MethodGet,
			0,
		},
		{
			"allows the basic logs usage endpoint",
			azureLogAnalytics,
			"/usage/basiclogs",
			http.MethodPost,
			0,
		},
		{
			"denies other log analytics paths",
			azureLogAnalytics,
			"/v1/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/sa/listKeys",
			http.MethodPost,
			http.StatusForbidden,
		},
		{
			"allows resource graph queries",
			azureResourceGraph,
			"/providers/Microsoft.ResourceGraph/resources",
			http.MethodPost,
			0,
		},
		{
			"denies other resource graph paths",
			azureResourceGraph,
			"/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/sa/listKeys",
			http.MethodPost,
			http.StatusForbidden,
		},
		{
			"denies unknown services",
			"unknown",
			"/subscriptions",
			http.MethodGet,
			http.StatusForbidden,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, msg := validateResourceRequest(tt.subDataSource, tt.path, tt.method)
			require.Equal(t, tt.expectedStatus, status)
			if tt.expectedStatus == 0 {
				require.Empty(t, msg)
			} else {
				require.NotEmpty(t, msg)
			}
		})
	}
}

func Test_handleResourceReq_allowlist(t *testing.T) {
	newService := func(proxy *fakeProxy) Service {
		return Service{
			im: &fakeInstance{
				services: map[string]types.DatasourceService{
					azureMonitor: {
						URL:        "https://management.azure.com",
						HTTPClient: &http.Client{},
						Logger:     log.DefaultLogger,
					},
					azureLogAnalytics: {
						URL:        "https://api.loganalytics.io",
						HTTPClient: &http.Client{},
						Logger:     log.DefaultLogger,
					},
				},
			},
			executors: map[string]azDatasourceExecutor{
				azureMonitor: &metrics.AzureMonitorDatasource{
					Proxy: proxy,
				},
				azureLogAnalytics: &loganalytics.AzureLogAnalyticsDatasource{
					Proxy:  proxy,
					Logger: log.DefaultLogger,
				},
			},
			logger: log.DefaultLogger,
		}
	}

	tests := []struct {
		name           string
		subDataSource  string
		method         string
		url            string
		expectedStatus int
		expectedURL    string
	}{
		{
			"proxies allowed metric definitions",
			azureMonitor,
			http.MethodGet,
			"http://foo/azuremonitor/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01",
			http.StatusOK,
			"https://management.azure.com/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01",
		},
		{
			"proxies allowed subscription listing",
			azureMonitor,
			http.MethodGet,
			"http://foo/azuremonitor/subscriptions?api-version=2019-03-01",
			http.StatusOK,
			"https://management.azure.com/subscriptions?api-version=2019-03-01",
		},
		{
			"proxies allowed log analytics query",
			azureLogAnalytics,
			http.MethodPost,
			"http://foo/loganalytics/v1/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.OperationalInsights/workspaces/ws/query",
			http.StatusOK,
			"https://api.loganalytics.io/v1/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.OperationalInsights/workspaces/ws/query",
		},
		{
			"denies storage account key listing",
			azureMonitor,
			http.MethodPost,
			"http://foo/azuremonitor/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/sa/listKeys?api-version=2023-01-01",
			http.StatusForbidden,
			"",
		},
		{
			"denies arbitrary ARM paths",
			azureMonitor,
			http.MethodGet,
			"http://foo/azuremonitor/subscriptions/44693801/resourceGroups/rg/providers/Microsoft.KeyVault/vaults/kv/secrets?api-version=2023-01-01",
			http.StatusForbidden,
			"",
		},
		{
			"denies encoded path traversal",
			azureMonitor,
			http.MethodGet,
			"http://foo/azuremonitor/subscriptions/44693801/locations/..%2f..%2fresourceGroups/rg/providers/Microsoft.Storage/storageAccounts/sa/listKeys",
			http.StatusForbidden,
			"",
		},
		{
			"denies plain path traversal",
			azureMonitor,
			http.MethodGet,
			"http://foo/azuremonitor/subscriptions/44693801/locations/../../providers/Microsoft.Storage/storageAccounts/sa/listKeys",
			http.StatusForbidden,
			"",
		},
		{
			"denies disallowed methods on allowed paths",
			azureMonitor,
			http.MethodDelete,
			"http://foo/azuremonitor/subscriptions/44693801/locations",
			http.StatusMethodNotAllowed,
			"",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			proxy := &fakeProxy{}
			s := newService(proxy)
			rw := httptest.NewRecorder()
			req, err := http.NewRequest(tt.method, tt.url, nil)
			require.NoError(t, err)

			s.handleResourceReq(tt.subDataSource)(rw, req)

			require.Equal(t, tt.expectedStatus, rw.Result().StatusCode)
			require.Equal(t, tt.expectedURL, proxy.requestedURL)
		})
	}
}
