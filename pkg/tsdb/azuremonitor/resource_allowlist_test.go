package azuremonitor

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/metrics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// The legitimate call shapes are derived directly from every getResource/
// postResource call site in public/app/plugins/datasource/azuremonitor
// (azure_monitor_datasource.ts, url_builder.ts, azure_log_analytics_datasource.ts,
// azure_resource_graph_datasource.ts).
func Test_isAllowedResourcePath_legitimateCalls(t *testing.T) {
	tests := []struct {
		name          string
		subDataSource string
		method        string
		path          string
	}{
		{"list subscriptions", azureMonitor, http.MethodGet, "/subscriptions"},
		{"list locations", azureMonitor, http.MethodGet, "/subscriptions/sub-1/locations"},
		{"list log analytics workspaces", azureMonitor, http.MethodGet, "/subscriptions/sub-1/providers/Microsoft.OperationalInsights/workspaces"},
		{"metric namespaces, single resource", azureMonitor, http.MethodGet, "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Compute/virtualMachines/vm-1/providers/microsoft.insights/metricNamespaces"},
		{"metric namespaces, subscription scope (globalRegion)", azureMonitor, http.MethodGet, "/subscriptions/sub-1/providers/microsoft.insights/metricNamespaces"},
		{"metric namespaces, nested resource type (server/database)", azureMonitor, http.MethodGet, "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Sql/servers/srv-1/databases/db-1/providers/microsoft.insights/metricNamespaces"},
		{"metric namespaces, mixed case provider", azureMonitor, http.MethodGet, "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Storage/storageAccounts/acct-1/providers/Microsoft.Insights/metricNamespaces"},
		{"metric definitions", azureMonitor, http.MethodGet, "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Compute/virtualMachines/vm-1/providers/microsoft.insights/metricdefinitions"},
		{"log analytics table plan", azureMonitor, http.MethodGet, "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.OperationalInsights/workspaces/ws-1/tables/MyTable"},
		{"log analytics metadata, global", azureLogAnalytics, http.MethodGet, "/v1/metadata"},
		{"log analytics metadata, workspace scoped", azureLogAnalytics, http.MethodGet, "/v1/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.OperationalInsights/workspaces/ws-1/metadata"},
		{"log analytics basiclogs usage", azureLogAnalytics, http.MethodPost, "/usage/basiclogs"},
		{"resource graph query", azureResourceGraph, http.MethodPost, "/providers/Microsoft.ResourceGraph/resources"},
		{"resource graph query, lowercase provider", azureResourceGraph, http.MethodPost, "/providers/microsoft.resourcegraph/resources"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.True(t, isAllowedResourcePath(tt.subDataSource, tt.method, tt.path),
				"expected %s %s on %q to be allowed", tt.method, tt.path, tt.subDataSource)
		})
	}
}

// None of these should ever reach the configured backend, regardless of
// verb, route, or casing/decoration used to try to smuggle them through.
func Test_isAllowedResourcePath_rejectsUnsupportedPaths(t *testing.T) {
	dangerousARMActions := []string{
		"listKeys",
		"listAccountSas",
		"listSecrets",
		"listAdminKeys",
		"listConnectionStrings",
		"listClusterAdminCredential",
		"regenerateKey",
		"restart",
		"start",
		"stop",
		"delete",
	}

	for _, action := range dangerousARMActions {
		path := "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Storage/storageAccounts/acct-1/" + action

		t.Run(action+" via POST on azuremonitor route (the reported attack)", func(t *testing.T) {
			require.False(t, isAllowedResourcePath(azureMonitor, http.MethodPost, path))
		})
		t.Run(action+" via GET on azuremonitor route", func(t *testing.T) {
			require.False(t, isAllowedResourcePath(azureMonitor, http.MethodGet, path))
		})
		t.Run(action+" via the resourcegraph route (same ARM identity, different mux prefix)", func(t *testing.T) {
			require.False(t, isAllowedResourcePath(azureResourceGraph, http.MethodPost, path))
		})
		t.Run(action+" via the loganalytics route", func(t *testing.T) {
			require.False(t, isAllowedResourcePath(azureLogAnalytics, http.MethodPost, path))
		})
		t.Run(action+" uppercased, to confirm the allowlist isn't just a case-sensitive denylist", func(t *testing.T) {
			require.False(t, isAllowedResourcePath(azureMonitor, http.MethodPost, "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Storage/storageAccounts/acct-1/"+strings.ToUpper(action)))
		})
	}

	methodConfusion := []struct {
		name          string
		subDataSource string
		method        string
		path          string
	}{
		{"GET where only POST is legitimate (resourcegraph)", azureResourceGraph, http.MethodGet, "/providers/Microsoft.ResourceGraph/resources"},
		{"POST where only GET is legitimate (metric namespaces)", azureMonitor, http.MethodPost, "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Compute/virtualMachines/vm-1/providers/microsoft.insights/metricNamespaces"},
		{"PUT on an otherwise-allowed subscriptions path", azureMonitor, http.MethodPut, "/subscriptions"},
		{"DELETE on an otherwise-allowed subscriptions path", azureMonitor, http.MethodDelete, "/subscriptions"},
	}
	for _, tt := range methodConfusion {
		t.Run(tt.name, func(t *testing.T) {
			require.False(t, isAllowedResourcePath(tt.subDataSource, tt.method, tt.path))
		})
	}

	shapeVariants := []struct {
		name          string
		subDataSource string
		method        string
		path          string
	}{
		{"trailing slash on an otherwise-exact match", azureMonitor, http.MethodGet, "/subscriptions/"},
		{"extra segment appended after an otherwise-exact match", azureResourceGraph, http.MethodPost, "/providers/Microsoft.ResourceGraph/resources/extra"},
		{"resource graph path smuggled onto the azuremonitor route", azureMonitor, http.MethodPost, "/providers/Microsoft.ResourceGraph/resources"},
		{"empty path", azureMonitor, http.MethodGet, ""},
		{"bare root", azureMonitor, http.MethodGet, "/"},
		{"unknown subDataSource key entirely", "some-other-route", http.MethodGet, "/subscriptions"},
		{"getProvider (/providers/<name>): dropped, not allowed -- unused by the frontend", azureMonitor, http.MethodGet, "/providers/Microsoft.Insights"},
	}
	for _, tt := range shapeVariants {
		t.Run(tt.name, func(t *testing.T) {
			require.False(t, isAllowedResourcePath(tt.subDataSource, tt.method, tt.path))
		})
	}
}

// net/http.ServeMux doesn't catch a percent-encoded dot-segment, so these
// must be rejected explicitly.
func Test_isAllowedResourcePath_rejectsDotSegmentsAndEscaping(t *testing.T) {
	tests := []struct {
		name          string
		subDataSource string
		path          string
	}{
		{"dot-segment escaping an otherwise-allowed metricNamespaces call out to listKeys",
			azureMonitor, "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Storage/storageAccounts/acct-1/../../../listKeys"},
		{"bare .. segment in the middle of an otherwise-allowed path",
			azureMonitor, "/subscriptions/sub-1/../sub-2/locations"},
		{"bare . segment",
			azureMonitor, "/subscriptions/./locations"},
		{"literal percent sign surviving decode (double-encoded traversal), otherwise-allowed suffix",
			azureMonitor, "/subscriptions/sub-1%2f..%2f../locations"},
		{"literal percent sign in an otherwise fully-matching metricNamespaces path",
			azureMonitor, "/subscriptions/sub-1%2fresourceGroups/rg-1/providers/microsoft.insights/metricNamespaces"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.False(t, isAllowedResourcePath(tt.subDataSource, http.MethodGet, tt.path))
		})
	}
}

// Same as above, but through the real mux/handler, not isAllowedResourcePath
// in isolation.
func Test_handleResourceReq_rejectsPercentEncodedTraversal(t *testing.T) {
	var backendWasHit bool
	mockARM := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		backendWasHit = true
		w.WriteHeader(http.StatusOK)
	}))
	defer mockARM.Close()

	s := Service{
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

	// %2e%2e%2f decodes to "../" in req.URL.Path without net/http.ServeMux
	// redirecting it away first (confirmed empirically), landing on
	// handleResourceReq with a literal ".." segment.
	req, err := http.NewRequest(http.MethodGet,
		"http://foo/azuremonitor/subscriptions/sub-1/%2e%2e%2f%2e%2e%2fstorageAccounts/acct-1/listKeys", nil)
	require.NoError(t, err)
	require.Contains(t, req.URL.Path, "..", "sanity check: the decoded path really does contain a literal dot-segment here")

	rw := httptest.NewRecorder()
	s.handleResourceReq(azureMonitor)(rw, req)

	require.False(t, backendWasHit)
	require.Equal(t, http.StatusForbidden, rw.Result().StatusCode)
}

// An empty/multi-value template variable can reach the handler as an
// empty path segment.
func Test_isAllowedResourcePath_rejectsEmptyPathSegments(t *testing.T) {
	tests := []struct {
		name string
		path string
	}{
		{"empty subscription before resourceGroups",
			"/subscriptions//resourceGroups/rg-1/providers/Microsoft.Compute/virtualMachines/vm-1/providers/microsoft.insights/metricNamespaces"},
		{"empty subscription, subscription-scope metricdefinitions",
			"/subscriptions//providers/microsoft.insights/metricdefinitions"},
		{"empty resourceGroup",
			"/subscriptions/sub-1/resourceGroups//providers/Microsoft.Compute/virtualMachines/vm-1/providers/microsoft.insights/metricNamespaces"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.False(t, isAllowedResourcePath(azureMonitor, http.MethodGet, tt.path))
		})
	}
}

// Not GET-only: the Resource Graph query (backs the whole resourcePicker)
// and the Log Analytics basic-logs usage query are both legitimately POST.
func Test_isAllowedResourcePath_cannotBeRestrictedToGETOnly(t *testing.T) {
	postOnlyLegitimateCalls := []struct {
		name          string
		subDataSource string
		path          string
	}{
		{"resource graph query backs the entire resource picker UI", azureResourceGraph, "/providers/Microsoft.ResourceGraph/resources"},
		{"log analytics basiclogs usage query", azureLogAnalytics, "/usage/basiclogs"},
	}
	for _, tt := range postOnlyLegitimateCalls {
		t.Run(tt.name, func(t *testing.T) {
			require.True(t, isAllowedResourcePath(tt.subDataSource, http.MethodPost, tt.path),
				"this call is POST-only in the frontend; forcing GET here would break the feature")
			require.False(t, isAllowedResourcePath(tt.subDataSource, http.MethodGet, tt.path),
				"and it must not also be reachable via GET")
		})
	}
}
