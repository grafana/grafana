package azuremonitor

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/metrics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func newVulnTestService(mockARM *httptest.Server) Service {
	return Service{
		im: &fakeInstance{
			services: map[string]types.DatasourceService{
				azureMonitor: {
					URL:        mockARM.URL,
					HTTPClient: mockARM.Client(),
					Logger:     log.DefaultLogger,
				},
			},
		},
		executors: map[string]azDatasourceExecutor{
			azureMonitor: &metrics.AzureMonitorDatasource{
				Proxy: &httpServiceProxy{logger: log.DefaultLogger},
			},
		},
		logger: log.DefaultLogger,
	}
}

// the resource proxy now rejects a
// request whose (method, path) doesn't match one of the ARM calls the
// datasource actually makes (see resource_allowlist.go), so an ARM "action"
// like listKeys never reaches the backend regardless of the caller's role.
func Test_handleResourceReq_rejectsArbitraryARMPath(t *testing.T) {
	var backendWasHit bool
	mockARM := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		backendWasHit = true
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"keys":[{"keyName":"key1","value":"SECRET-STORAGE-KEY"}]}`))
	}))
	defer mockARM.Close()

	s := newVulnTestService(mockARM)

	armPath := "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Storage/storageAccounts/acct-1/listKeys"
	req, err := http.NewRequest(http.MethodPost, "http://foo/azuremonitor"+armPath+"?api-version=2022-09-01", nil)
	require.NoError(t, err)

	rw := httptest.NewRecorder()
	s.handleResourceReq(azureMonitor)(rw, req)

	require.False(t, backendWasHit, "the mock ARM backend should never have been called")
	require.Equal(t, http.StatusForbidden, rw.Result().StatusCode)
}

// The same fix must not break the calls the datasource legitimately makes.
func Test_handleResourceReq_legitimateCallsStillWork(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"list subscriptions", http.MethodGet, "/azuremonitor/subscriptions"},
		{"list locations", http.MethodGet, "/azuremonitor/subscriptions/sub-1/locations"},
		{"list log analytics workspaces", http.MethodGet, "/azuremonitor/subscriptions/sub-1/providers/Microsoft.OperationalInsights/workspaces"},
		{"get metric namespaces", http.MethodGet, "/azuremonitor/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Compute/virtualMachines/vm-1/providers/microsoft.insights/metricNamespaces"},
		{"get metric definitions", http.MethodGet, "/azuremonitor/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Compute/virtualMachines/vm-1/providers/microsoft.insights/metricdefinitions"},
		{"get log analytics table plan", http.MethodGet, "/azuremonitor/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.OperationalInsights/workspaces/ws-1/tables/MyTable"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var backendWasHit bool
			mockARM := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				backendWasHit = true
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{}`))
			}))
			defer mockARM.Close()

			s := newVulnTestService(mockARM)

			req, err := http.NewRequest(tt.method, "http://foo"+tt.path+"?api-version=2021-01-01", nil)
			require.NoError(t, err)

			rw := httptest.NewRecorder()
			s.handleResourceReq(azureMonitor)(rw, req)

			body, _ := io.ReadAll(rw.Result().Body)
			require.True(t, backendWasHit, "expected a legitimate call to reach the backend, got status %d body %s", rw.Result().StatusCode, body)
			require.Equal(t, http.StatusOK, rw.Result().StatusCode)
		})
	}
}
