package azuremonitor

import (
	"fmt"
	"net/url"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestBuildingAzureLogAnalyticsQueries(t *testing.T) {
	datasource := &AzureLogAnalyticsDatasource{}
	fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
	timeRange := backend.TimeRange{From: fromStart, To: fromStart.Add(34 * time.Minute)}

	tests := []struct {
		name                     string
		queryModel               []backend.DataQuery
		azureLogAnalyticsQueries []*AzureLogAnalyticsQuery
		Err                      require.ErrorAssertionFunc
	}{
		{
			name: "Query with macros should be interpolated",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "query=Perf | where $__timeFilter() | where $__contains(Computer, 'comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer",
							"resultFormat": "%s"
						}
					}`, timeSeries)),
					RefID:     "A",
					TimeRange: timeRange,
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: timeSeries,
					URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace/query",
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "query=Perf | where $__timeFilter() | where $__contains(Computer, 'comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer",
							"resultFormat": "%s"
						}
					}`, timeSeries)),
					Params:    url.Values{"query": {"query=Perf | where ['TimeGenerated'] >= datetime('2018-03-15T13:00:00Z') and ['TimeGenerated'] <= datetime('2018-03-15T13:34:00Z') | where ['Computer'] in ('comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, 34000ms), Computer"}},
					Target:    "query=query%3DPerf+%7C+where+%5B%27TimeGenerated%27%5D+%3E%3D+datetime%28%272018-03-15T13%3A00%3A00Z%27%29+and+%5B%27TimeGenerated%27%5D+%3C%3D+datetime%28%272018-03-15T13%3A34%3A00Z%27%29+%7C+where+%5B%27Computer%27%5D+in+%28%27comp1%27%2C%27comp2%27%29+%7C+summarize+avg%28CounterValue%29+by+bin%28TimeGenerated%2C+34000ms%29%2C+Computer",
					TimeRange: timeRange,
				},
			},
			Err: require.NoError,
		},

		{
			name: "Legacy queries with a workspace GUID should use workspace-centric url",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"workspace":    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
							"query":        "query=Perf",
							"resultFormat": "%s"
						}
					}`, timeSeries)),
					RefID: "A",
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: timeSeries,
					URL:          "v1/workspaces/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/query",
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"workspace":    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
							"query":        "query=Perf",
							"resultFormat": "%s"
						}
					}`, timeSeries)),
					Params: url.Values{"query": {"query=Perf"}},
					Target: "query=query%3DPerf",
				},
			},
			Err: require.NoError,
		},

		{
			name: "Legacy workspace queries with a resource URI (from a template variable) should use resource-centric url",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"workspace":    "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "query=Perf",
							"resultFormat": "%s"
						}
					}`, timeSeries)),
					RefID: "A",
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: timeSeries,
					URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace/query",
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"workspace":    "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "query=Perf",
							"resultFormat": "%s"
						}
					}`, timeSeries)),
					Params: url.Values{"query": {"query=Perf"}},
					Target: "query=query%3DPerf",
				},
			},
			Err: require.NoError,
		},

		{
			name: "Queries with a Resource should use resource-centric url",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "query=Perf",
							"resultFormat": "%s"
						}
					}`, timeSeries)),
					RefID: "A",
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: timeSeries,
					URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace/query",
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "query=Perf",
							"resultFormat": "%s"
						}
					}`, timeSeries)),
					Params: url.Values{"query": {"query=Perf"}},
					Target: "query=query%3DPerf",
				},
			},
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			queries, err := datasource.buildQueries(tt.queryModel, datasourceInfo{})
			tt.Err(t, err)
			if diff := cmp.Diff(tt.azureLogAnalyticsQueries[0], queries[0]); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestPluginRoutes(t *testing.T) {
	cfg := &setting.Cfg{
		Azure: setting.AzureSettings{
			Cloud:                  setting.AzurePublic,
			ManagedIdentityEnabled: true,
		},
	}

	plugin := &plugins.DataSourcePlugin{
		Routes: []*plugins.AppPluginRoute{
			{
				Path:   "loganalyticsazure",
				Method: "GET",
				URL:    "https://api.loganalytics.io/",
				Headers: []plugins.AppPluginRouteHeader{
					{Name: "x-ms-app", Content: "Grafana"},
				},
			},
			{
				Path:   "chinaloganalyticsazure",
				Method: "GET",
				URL:    "https://api.loganalytics.azure.cn/",
				Headers: []plugins.AppPluginRouteHeader{
					{Name: "x-ms-app", Content: "Grafana"},
				},
			},
			{
				Path:   "govloganalyticsazure",
				Method: "GET",
				URL:    "https://api.loganalytics.us/",
				Headers: []plugins.AppPluginRouteHeader{
					{Name: "x-ms-app", Content: "Grafana"},
				},
			},
		},
	}

	tests := []struct {
		name              string
		dsInfo            datasourceInfo
		datasource        *AzureLogAnalyticsDatasource
		expectedProxypass string
		expectedRouteURL  string
		Err               require.ErrorAssertionFunc
	}{
		{
			name: "plugin proxy route for the Azure public cloud",
			dsInfo: datasourceInfo{
				Settings: azureMonitorSettings{
					AzureAuthType: AzureAuthClientSecret,
					CloudName:     "azuremonitor",
				},
			},
			datasource: &AzureLogAnalyticsDatasource{
				cfg: cfg,
			},
			expectedProxypass: "loganalyticsazure",
			expectedRouteURL:  "https://api.loganalytics.io/",
			Err:               require.NoError,
		},
		{
			name: "plugin proxy route for the Azure China cloud",
			dsInfo: datasourceInfo{
				Settings: azureMonitorSettings{
					AzureAuthType: AzureAuthClientSecret,
					CloudName:     "chinaazuremonitor",
				},
			},
			datasource: &AzureLogAnalyticsDatasource{
				cfg: cfg,
			},
			expectedProxypass: "chinaloganalyticsazure",
			expectedRouteURL:  "https://api.loganalytics.azure.cn/",
			Err:               require.NoError,
		},
		{
			name: "plugin proxy route for the Azure Gov cloud",
			dsInfo: datasourceInfo{
				Settings: azureMonitorSettings{
					AzureAuthType: AzureAuthClientSecret,
					CloudName:     "govazuremonitor",
				},
			},
			datasource: &AzureLogAnalyticsDatasource{
				cfg: cfg,
			},
			expectedProxypass: "govloganalyticsazure",
			expectedRouteURL:  "https://api.loganalytics.us/",
			Err:               require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			route, proxypass, err := tt.datasource.getPluginRoute(plugin, tt.dsInfo)
			tt.Err(t, err)

			if diff := cmp.Diff(tt.expectedRouteURL, route.URL, cmpopts.EquateNaNs()); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tt.expectedProxypass, proxypass, cmpopts.EquateNaNs()); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
