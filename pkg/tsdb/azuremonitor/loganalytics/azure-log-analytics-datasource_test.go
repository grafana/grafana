package loganalytics

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func makeQueryPointer(q AzureLogAnalyticsQuery) *AzureLogAnalyticsQuery {
	return &q
}

func TestBuildLogAnalyticsQuery(t *testing.T) {
	fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
	timeRange := backend.TimeRange{From: fromStart, To: fromStart.Add(34 * time.Minute)}
	svr := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		var correlationRes AzureCorrelationAPIResponse
		if strings.Contains(r.URL.Path, "test-op-id") {
			correlationRes = AzureCorrelationAPIResponse{
				ID:   "/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1",
				Name: "guid-1",
				Type: "microsoft.insights/transactions",
				Properties: AzureCorrelationAPIResponseProperties{
					Resources: []string{
						"/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1",
					},
					NextLink: nil,
				},
			}
		} else if strings.Contains(r.URL.Path, "op-id-multi") {
			correlationRes = AzureCorrelationAPIResponse{
				ID:   "/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1",
				Name: "guid-1",
				Type: "microsoft.insights/transactions",
				Properties: AzureCorrelationAPIResponseProperties{
					Resources: []string{
						"/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1",
						"/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r2",
					},
					NextLink: nil,
				},
			}
		} else if strings.Contains(r.URL.Path, "op-id-non-overlapping") {
			correlationRes = AzureCorrelationAPIResponse{
				ID:   "/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1",
				Name: "guid-1",
				Type: "microsoft.insights/transactions",
				Properties: AzureCorrelationAPIResponseProperties{
					Resources: []string{
						"/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1",
						"/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r3",
					},
					NextLink: nil,
				},
			}
		}
		err := json.NewEncoder(w).Encode(correlationRes)
		if err != nil {
			t.Errorf("failed to encode correlation API response")
		}
	}))

	provider := httpclient.NewProvider(httpclient.ProviderOptions{Timeout: &httpclient.DefaultTimeoutOptions})
	client, err := provider.New()
	if err != nil {
		t.Errorf("failed to create fake client")
	}

	appInsightsRegExp, err := regexp.Compile("(?i)providers/microsoft.insights/components")
	if err != nil {
		t.Error("failed to compile reg: %w", err)
	}

	tests := []struct {
		name                   string
		fromAlert              bool
		basicLogsEnabled       bool
		queryModel             backend.DataQuery
		azureLogAnalyticsQuery *AzureLogAnalyticsQuery
		Err                    require.ErrorAssertionFunc
	}{
		{
			name:      "Query with macros should be interpolated",
			fromAlert: false,
			queryModel: backend.DataQuery{
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf | where $__timeFilter() | where $__contains(Computer, 'comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer",
							"resultFormat": "%s",
							"dashboardTime": false
						}
					}`, dataquery.ResultFormatTimeSeries)),
				RefID:     "A",
				TimeRange: timeRange,
				QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
			},
			azureLogAnalyticsQuery: makeQueryPointer(AzureLogAnalyticsQuery{
				RefID:        "A",
				ResultFormat: dataquery.ResultFormatTimeSeries,
				URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace/query",
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf | where $__timeFilter() | where $__contains(Computer, 'comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer",
							"resultFormat": "%s",
							"dashboardTime": false
						}
					}`, dataquery.ResultFormatTimeSeries)),
				Query:            "Perf | where ['TimeGenerated'] >= datetime('2018-03-15T13:00:00Z') and ['TimeGenerated'] <= datetime('2018-03-15T13:34:00Z') | where ['Computer'] in ('comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, 34000ms), Computer",
				Resources:        []string{"/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace"},
				TimeRange:        timeRange,
				QueryType:        dataquery.AzureQueryTypeAzureLogAnalytics,
				AppInsightsQuery: false,
				DashboardTime:    false,
			}),
			Err: require.NoError,
		},
		{
			name:      "Legacy queries with a workspace GUID should use workspace-centric url",
			fromAlert: false,
			queryModel: backend.DataQuery{
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"workspace":    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, dataquery.ResultFormatTimeSeries)),
				RefID:     "A",
				QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
			},
			azureLogAnalyticsQuery: makeQueryPointer(AzureLogAnalyticsQuery{
				RefID:        "A",
				ResultFormat: dataquery.ResultFormatTimeSeries,
				URL:          "v1/workspaces/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/query",
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"workspace":    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, dataquery.ResultFormatTimeSeries)),
				Query:            "Perf",
				Resources:        []string{},
				QueryType:        dataquery.AzureQueryTypeAzureLogAnalytics,
				AppInsightsQuery: false,
				DashboardTime:    false,
			}),
			Err: require.NoError,
		},
		{
			name:      "Legacy workspace queries with a resource URI (from a template variable) should use resource-centric url",
			fromAlert: false,
			queryModel: backend.DataQuery{
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"workspace":    "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, dataquery.ResultFormatTimeSeries)),
				RefID:     "A",
				QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
			},
			azureLogAnalyticsQuery: makeQueryPointer(AzureLogAnalyticsQuery{
				RefID:        "A",
				ResultFormat: dataquery.ResultFormatTimeSeries,
				URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace/query",
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"workspace":    "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, dataquery.ResultFormatTimeSeries)),
				Query:            "Perf",
				Resources:        []string{},
				QueryType:        dataquery.AzureQueryTypeAzureLogAnalytics,
				AppInsightsQuery: false,
				DashboardTime:    false,
			}),
			Err: require.NoError,
		},
		{
			name:      "Queries with multiple resources",
			fromAlert: false,
			queryModel: backend.DataQuery{
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf",
							"resultFormat": "%s",
							"dashboardTime": false
						}
					}`, dataquery.ResultFormatTimeSeries)),
				RefID:     "A",
				QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
			},
			azureLogAnalyticsQuery: makeQueryPointer(AzureLogAnalyticsQuery{
				RefID:        "A",
				ResultFormat: dataquery.ResultFormatTimeSeries,
				URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace/query",
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf",
							"resultFormat": "%s",
							"dashboardTime": false
						}
					}`, dataquery.ResultFormatTimeSeries)),
				Query:            "Perf",
				Resources:        []string{"/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace"},
				QueryType:        dataquery.AzureQueryTypeAzureLogAnalytics,
				AppInsightsQuery: false,
				DashboardTime:    false,
			}),
			Err: require.NoError,
		},
		{
			name:      "Query with multiple resources",
			fromAlert: false,
			queryModel: backend.DataQuery{
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",  "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace2"],
							"query":        "Perf",
							"resultFormat": "%s",
							"dashboardTime": false
						}
					}`, dataquery.ResultFormatTimeSeries)),
				RefID:     "A",
				TimeRange: timeRange,
				QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
			},
			azureLogAnalyticsQuery: makeQueryPointer(AzureLogAnalyticsQuery{
				RefID:        "A",
				ResultFormat: dataquery.ResultFormatTimeSeries,
				URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace/query",
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",  "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace2"],
							"query":        "Perf",
							"resultFormat": "%s",
							"dashboardTime": false
						}
					}`, dataquery.ResultFormatTimeSeries)),
				Query:            "Perf",
				Resources:        []string{"/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace", "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace2"},
				TimeRange:        timeRange,
				QueryType:        dataquery.AzureQueryTypeAzureLogAnalytics,
				AppInsightsQuery: false,
				DashboardTime:    false,
			}),
			Err: require.NoError,
		},
		{
			name:      "Query that uses dashboard time",
			fromAlert: false,
			queryModel: backend.DataQuery{
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace"],
							"query":        "Perf",
							"resultFormat": "%s",
							"dashboardTime": true,
							"timeColumn":	"TimeGenerated"
						}
					}`, dataquery.ResultFormatTimeSeries)),
				RefID:     "A",
				TimeRange: timeRange,
				QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
			},
			azureLogAnalyticsQuery: makeQueryPointer(AzureLogAnalyticsQuery{
				RefID:        "A",
				ResultFormat: dataquery.ResultFormatTimeSeries,
				URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace/query",
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace"],
							"query":        "Perf",
							"resultFormat": "%s",
							"dashboardTime": true,
							"timeColumn":	"TimeGenerated"
						}
					}`, dataquery.ResultFormatTimeSeries)),
				Query:            "Perf",
				Resources:        []string{"/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace"},
				TimeRange:        timeRange,
				QueryType:        dataquery.AzureQueryTypeAzureLogAnalytics,
				AppInsightsQuery: false,
				DashboardTime:    true,
				TimeColumn:       "TimeGenerated",
			}),
			Err: require.NoError,
		},
		{
			name:             "Basic Logs query",
			fromAlert:        false,
			basicLogsEnabled: true,
			queryModel: backend.DataQuery{
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/TestDataWorkspace"],
							"query":        "Perf",
							"resultFormat": "%s",
							"dashboardTime": true,
							"timeColumn":	"TimeGenerated",
							"basicLogsQuery": true
						}
					}`, dataquery.ResultFormatTimeSeries)),
				RefID:     "A",
				TimeRange: timeRange,
				QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
			},
			azureLogAnalyticsQuery: makeQueryPointer(AzureLogAnalyticsQuery{
				RefID:        "A",
				ResultFormat: dataquery.ResultFormatTimeSeries,
				URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/TestDataWorkspace/search",
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/TestDataWorkspace"],
							"query":        "Perf",
							"resultFormat": "%s",
							"dashboardTime": true,
							"timeColumn":	"TimeGenerated",
							"basicLogsQuery": true
						}
					}`, dataquery.ResultFormatTimeSeries)),
				Query:            "Perf",
				Resources:        []string{"/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/TestDataWorkspace"},
				TimeRange:        timeRange,
				QueryType:        dataquery.AzureQueryTypeAzureLogAnalytics,
				AppInsightsQuery: false,
				DashboardTime:    true,
				BasicLogs:        true,
				TimeColumn:       "TimeGenerated",
			}),
			Err: require.NoError,
		},
		{
			name:             "Basic Logs query with multiple resources",
			fromAlert:        false,
			basicLogsEnabled: true,
			queryModel: backend.DataQuery{
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/TestDataWorkspace1", "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/TestDataWorkspace2"],
							"query":        "Perf",
							"resultFormat": "%s",
							"dashboardTime": true,
							"timeColumn":	"TimeGenerated",
							"basicLogsQuery": true
						}
					}`, dataquery.ResultFormatTimeSeries)),
				RefID:     "A",
				TimeRange: timeRange,
				QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
			},
			azureLogAnalyticsQuery: nil,
			Err:                    require.Error,
		},
		{
			name:             "Basic Logs query with non LA workspace resources",
			fromAlert:        false,
			basicLogsEnabled: true,
			queryModel: backend.DataQuery{
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1"],
							"query":        "Perf",
							"resultFormat": "%s",
							"dashboardTime": true,
							"timeColumn":	"TimeGenerated",
							"basicLogsQuery": true
						}
					}`, dataquery.ResultFormatTimeSeries)),
				RefID:     "A",
				TimeRange: timeRange,
				QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
			},
			azureLogAnalyticsQuery: nil,
			Err:                    require.Error,
		},
		{
			name:             "Basic Logs query from alerts",
			fromAlert:        true,
			basicLogsEnabled: true,
			queryModel: backend.DataQuery{
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1"],
							"query":        "Perf",
							"resultFormat": "%s",
							"dashboardTime": true,
							"timeColumn":	"TimeGenerated",
							"basicLogsQuery": true
						}
					}`, dataquery.ResultFormatTimeSeries)),
				RefID:     "A",
				TimeRange: timeRange,
				QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
			},
			azureLogAnalyticsQuery: nil,
			Err:                    require.Error,
		},
		{
			name:             "Basic Logs query fails if basicLogsEnabled is set to false",
			fromAlert:        true,
			basicLogsEnabled: false,
			queryModel: backend.DataQuery{
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1"],
							"query":        "Perf",
							"resultFormat": "%s",
							"dashboardTime": true,
							"timeColumn":   "TimeGenerated",
							"basicLogsQuery": true
						}
					}`, dataquery.ResultFormatTimeSeries)),
				RefID:     "A",
				TimeRange: timeRange,
				QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
			},
			azureLogAnalyticsQuery: nil,
			Err:                    require.Error,
		},

		{
			name:      "Detects App Insights resource queries",
			fromAlert: false,
			queryModel: backend.DataQuery{
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Insights/components/AppInsightsTestDataWorkspace"],
							"query":        "Perf | where $__timeFilter() | where $__contains(Computer, 'comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer",
							"resultFormat": "%s",
							"dashboardTime": false
						}
					}`, dataquery.ResultFormatTimeSeries)),
				RefID:     "A",
				TimeRange: timeRange,
				QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
			},
			azureLogAnalyticsQuery: makeQueryPointer(AzureLogAnalyticsQuery{
				RefID:        "A",
				ResultFormat: dataquery.ResultFormatTimeSeries,
				URL:          "v1/apps/AppInsightsTestDataWorkspace/query",
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Insights/components/AppInsightsTestDataWorkspace"],
							"query":        "Perf | where $__timeFilter() | where $__contains(Computer, 'comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer",
							"resultFormat": "%s",
							"dashboardTime": false
						}
					}`, dataquery.ResultFormatTimeSeries)),
				Query:            "Perf | where ['TimeGenerated'] >= datetime('2018-03-15T13:00:00Z') and ['TimeGenerated'] <= datetime('2018-03-15T13:34:00Z') | where ['Computer'] in ('comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, 34000ms), Computer",
				Resources:        []string{"/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Insights/components/AppInsightsTestDataWorkspace"},
				TimeRange:        timeRange,
				QueryType:        dataquery.AzureQueryTypeAzureLogAnalytics,
				AppInsightsQuery: true,
				DashboardTime:    false,
			}),
			Err: require.NoError,
		},
		{
			name:      "Detects App Insights resource queries (case insensitive)",
			fromAlert: false,
			queryModel: backend.DataQuery{
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/microsoft.insights/components/AppInsightsTestDataWorkspace"],
							"query":        "Perf | where $__timeFilter() | where $__contains(Computer, 'comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer",
							"resultFormat": "%s",
							"dashboardTime": false
						}
					}`, dataquery.ResultFormatTimeSeries)),
				RefID:     "A",
				TimeRange: timeRange,
				QueryType: string(dataquery.AzureQueryTypeAzureLogAnalytics),
			},
			azureLogAnalyticsQuery: makeQueryPointer(AzureLogAnalyticsQuery{
				RefID:        "A",
				ResultFormat: dataquery.ResultFormatTimeSeries,
				URL:          "v1/apps/AppInsightsTestDataWorkspace/query",
				JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/microsoft.insights/components/AppInsightsTestDataWorkspace"],
							"query":        "Perf | where $__timeFilter() | where $__contains(Computer, 'comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer",
							"resultFormat": "%s",
							"dashboardTime": false
						}
					}`, dataquery.ResultFormatTimeSeries)),
				Query:            "Perf | where ['TimeGenerated'] >= datetime('2018-03-15T13:00:00Z') and ['TimeGenerated'] <= datetime('2018-03-15T13:34:00Z') | where ['Computer'] in ('comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, 34000ms), Computer",
				Resources:        []string{"/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/microsoft.insights/components/AppInsightsTestDataWorkspace"},
				TimeRange:        timeRange,
				QueryType:        dataquery.AzureQueryTypeAzureLogAnalytics,
				AppInsightsQuery: true,
				DashboardTime:    false,
			}),
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dsInfo := types.DatasourceInfo{
				Services: map[string]types.DatasourceService{
					"Azure Monitor": {URL: svr.URL, HTTPClient: client},
				},
				JSONData: map[string]any{
					"azureLogAnalyticsSameAs": false,
					"basicLogsEnabled":        tt.basicLogsEnabled, // Use the value from the current test case
				},
			}
			query, err := buildLogAnalyticsQuery(tt.queryModel, dsInfo, appInsightsRegExp, tt.fromAlert)
			tt.Err(t, err)
			if diff := cmp.Diff(tt.azureLogAnalyticsQuery, query); diff != "" {
				t.Errorf("Result mismatch (-want +got): \n%s", diff)
			}
		})
	}
}

func TestLogAnalyticsCreateRequest(t *testing.T) {
	ctx := context.Background()
	url := "http://ds/"

	t.Run("creates a request", func(t *testing.T) {
		ds := AzureLogAnalyticsDatasource{}
		req, err := ds.createRequest(ctx, url, &AzureLogAnalyticsQuery{
			Resources:        []string{"r"},
			Query:            "Perf",
			DashboardTime:    false,
			AppInsightsQuery: false,
		})
		require.NoError(t, err)
		if req.URL.String() != url {
			t.Errorf("Expecting %s, got %s", url, req.URL.String())
		}
		expectedHeaders := http.Header{"Content-Type": []string{"application/json"}}
		if !cmp.Equal(req.Header, expectedHeaders) {
			t.Errorf("Unexpected HTTP headers: %v", cmp.Diff(req.Header, expectedHeaders))
		}
		expectedBody := `{"query":"Perf"}`
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		if !cmp.Equal(string(body), expectedBody) {
			t.Errorf("Unexpected Body: %v", cmp.Diff(string(body), expectedBody))
		}
	})

	t.Run("creates a request with multiple resources", func(t *testing.T) {
		ds := AzureLogAnalyticsDatasource{}
		req, err := ds.createRequest(ctx, url, &AzureLogAnalyticsQuery{
			Resources:        []string{"/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.OperationalInsights/workspaces/r1", "/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.OperationalInsights/workspaces/r2"},
			Query:            "Perf",
			QueryType:        dataquery.AzureQueryTypeAzureLogAnalytics,
			AppInsightsQuery: false,
			DashboardTime:    false,
		})
		require.NoError(t, err)
		expectedBody := `{"query":"Perf","workspaces":["/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.OperationalInsights/workspaces/r1","/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.OperationalInsights/workspaces/r2"]}`
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		if !cmp.Equal(string(body), expectedBody) {
			t.Errorf("Unexpected Body: %v", cmp.Diff(string(body), expectedBody))
		}
	})

	t.Run("creates a request with timerange from dashboard", func(t *testing.T) {
		ds := AzureLogAnalyticsDatasource{}
		from := time.Now()
		to := from.Add(3 * time.Hour)
		req, err := ds.createRequest(ctx, url, &AzureLogAnalyticsQuery{
			Resources: []string{"/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.OperationalInsights/workspaces/r1", "/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.OperationalInsights/workspaces/r2"},
			Query:     "Perf",
			QueryType: dataquery.AzureQueryTypeAzureLogAnalytics,
			TimeRange: backend.TimeRange{
				From: from,
				To:   to,
			},
			AppInsightsQuery: false,
			DashboardTime:    true,
			TimeColumn:       "TimeGenerated",
		})
		require.NoError(t, err)
		expectedBody := fmt.Sprintf(`{"query":"Perf","query_datetimescope_column":"TimeGenerated","query_datetimescope_from":"%s","query_datetimescope_to":"%s","timespan":"%s/%s","workspaces":["/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.OperationalInsights/workspaces/r1","/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.OperationalInsights/workspaces/r2"]}`, from.Format(time.RFC3339), to.Format(time.RFC3339), from.Format(time.RFC3339), to.Format(time.RFC3339))
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		if !cmp.Equal(string(body), expectedBody) {
			t.Errorf("Unexpected Body: %v", cmp.Diff(string(body), expectedBody))
		}
	})

	t.Run("correctly passes multiple resources for traces queries", func(t *testing.T) {
		ds := AzureLogAnalyticsDatasource{}
		from := time.Now()
		to := from.Add(3 * time.Hour)
		req, err := ds.createRequest(ctx, url, &AzureLogAnalyticsQuery{
			Resources: []string{"/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1", "/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r2"},
			QueryType: dataquery.AzureQueryTypeAzureTraces,
			TimeRange: backend.TimeRange{
				From: from,
				To:   to,
			},
			AppInsightsQuery: true,
			DashboardTime:    true,
			TimeColumn:       "timestamp",
		})
		require.NoError(t, err)
		expectedBody := fmt.Sprintf(`{"applications":["/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1"],"query":"","query_datetimescope_column":"timestamp","query_datetimescope_from":"%s","query_datetimescope_to":"%s","timespan":"%s/%s"}`, from.Format(time.RFC3339), to.Format(time.RFC3339), from.Format(time.RFC3339), to.Format(time.RFC3339))
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		if !cmp.Equal(string(body), expectedBody) {
			t.Errorf("Unexpected Body: %v", cmp.Diff(string(body), expectedBody))
		}
	})

	t.Run("correctly classifies resources as workspaces when matching criteria", func(t *testing.T) {
		ds := AzureLogAnalyticsDatasource{}
		req, err := ds.createRequest(ctx, url, &AzureLogAnalyticsQuery{
			Resources:        []string{"/subscriptions/test-sub/resourceGroups/test-rg/providers/microsoft.operationalInsights/workSpaces/ws1", "microsoft.operationalInsights/workspaces/ws2"}, // Note different casings and partial paths
			Query:            "Perf",
			QueryType:        dataquery.AzureQueryTypeAzureLogAnalytics,
			AppInsightsQuery: false,
			DashboardTime:    false,
		})
		require.NoError(t, err)
		expectedBody := `{"query":"Perf","workspaces":["/subscriptions/test-sub/resourceGroups/test-rg/providers/microsoft.operationalInsights/workSpaces/ws1","microsoft.operationalInsights/workspaces/ws2"]}` // Expecting resources to be classified as workspaces
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		if !cmp.Equal(string(body), expectedBody) {
			t.Errorf("Unexpected Body: %v", cmp.Diff(string(body), expectedBody))
		}
	})

	t.Run("correctly passes multiple resources not classified as workspaces", func(t *testing.T) {
		ds := AzureLogAnalyticsDatasource{}
		req, err := ds.createRequest(ctx, url, &AzureLogAnalyticsQuery{
			Resources:        []string{"/subscriptions/test-sub/resourceGroups/test-rg/providers/SomeOtherService/serviceInstances/r1", "/subscriptions/test-sub/resourceGroups/test-rg/providers/SomeOtherService/serviceInstances/r2"},
			Query:            "Perf",
			QueryType:        dataquery.AzureQueryTypeAzureLogAnalytics,
			AppInsightsQuery: false,
			DashboardTime:    false,
		})
		require.NoError(t, err)
		expectedBody := `{"query":"Perf","resources":["/subscriptions/test-sub/resourceGroups/test-rg/providers/SomeOtherService/serviceInstances/r1","/subscriptions/test-sub/resourceGroups/test-rg/providers/SomeOtherService/serviceInstances/r2"]}`
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		if !cmp.Equal(string(body), expectedBody) {
			t.Errorf("Unexpected Body: %v", cmp.Diff(string(body), expectedBody))
		}
	})
}

func Test_executeQueryErrorWithDifferentLogAnalyticsCreds(t *testing.T) {
	ds := AzureLogAnalyticsDatasource{}
	dsInfo := types.DatasourceInfo{
		Services: map[string]types.DatasourceService{
			"Azure Log Analytics": {URL: "http://ds"},
		},
		JSONData: map[string]any{
			"azureLogAnalyticsSameAs": false,
		},
	}
	ctx := context.Background()
	query := &AzureLogAnalyticsQuery{
		TimeRange: backend.TimeRange{},
	}
	_, err := ds.executeQuery(ctx, query, dsInfo, &http.Client{}, dsInfo.Services["Azure Log Analytics"].URL)
	if err == nil {
		t.Fatal("expecting an error")
	}
	if !strings.Contains(err.Error(), "credentials for Log Analytics are no longer supported") {
		t.Error("expecting the error to inform of bad credentials")
	}
}

func Test_exemplarsFeatureToggle(t *testing.T) {
	svr := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		correlationRes := AzureCorrelationAPIResponse{
			ID:   "/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1",
			Name: "guid-1",
			Type: "microsoft.insights/transactions",
			Properties: AzureCorrelationAPIResponseProperties{
				Resources: []string{
					"/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1",
				},
				NextLink: nil,
			},
		}
		err := json.NewEncoder(w).Encode(correlationRes)
		if err != nil {
			t.Errorf("failed to encode correlation API response")
		}
	}))

	provider := httpclient.NewProvider(httpclient.ProviderOptions{Timeout: &httpclient.DefaultTimeoutOptions})
	client, err := provider.New()
	if err != nil {
		t.Errorf("failed to create fake client")
	}

	ds := AzureLogAnalyticsDatasource{}
	dsInfo := types.DatasourceInfo{
		Services: map[string]types.DatasourceService{
			"Azure Log Analytics": {URL: "http://ds"},
			"Azure Monitor":       {URL: svr.URL, HTTPClient: client},
		},
		Settings: types.AzureMonitorSettings{
			SubscriptionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
		},
	}

	t.Run("does not error if feature toggle enabled", func(t *testing.T) {
		ctx := context.Background()
		ctx = backend.WithGrafanaConfig(ctx, backend.NewGrafanaCfg(map[string]string{"GF_INSTANCE_FEATURE_TOGGLES_ENABLE": "azureMonitorPrometheusExemplars"}))
		query := backend.DataQuery{
			JSON: []byte(`{
					"queryType": "traceql",
					"azureTraces": {
						"operationId": "traceid"
					},
					"query":     "traceid"
				}`),
			RefID:     "A",
			QueryType: string(dataquery.AzureQueryTypeTraceql),
		}

		_, err := ds.buildQuery(ctx, query, dsInfo, false)

		require.NoError(t, err)
	})

	t.Run("errors if feature toggle disabled", func(t *testing.T) {
		ctx := context.Background()
		ctx = backend.WithGrafanaConfig(ctx, backend.NewGrafanaCfg(map[string]string{"GF_INSTANCE_FEATURE_TOGGLES_ENABLE": ""}))
		query := backend.DataQuery{
			JSON: []byte(`{
					"queryType": "traceql",
					"azureTraces": {
						"operationId": "traceid"
					},
					"query":     "traceid"
				}`),
			RefID:     "A",
			QueryType: string(dataquery.AzureQueryTypeTraceql),
		}

		_, err := ds.buildQuery(ctx, query, dsInfo, false)

		require.Error(t, err, "query type unsupported as azureMonitorPrometheusExemplars feature toggle is not enabled")
	})
}
