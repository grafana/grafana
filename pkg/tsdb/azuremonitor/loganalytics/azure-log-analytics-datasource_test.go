package loganalytics

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

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
				QueryType: string(dataquery.AzureQueryTypeLogAnalytics),
			},
			azureLogAnalyticsQuery: new(AzureLogAnalyticsQuery{
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
				QueryType:        dataquery.AzureQueryTypeLogAnalytics,
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
				QueryType: string(dataquery.AzureQueryTypeLogAnalytics),
			},
			azureLogAnalyticsQuery: new(AzureLogAnalyticsQuery{
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
				QueryType:        dataquery.AzureQueryTypeLogAnalytics,
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
				QueryType: string(dataquery.AzureQueryTypeLogAnalytics),
			},
			azureLogAnalyticsQuery: new(AzureLogAnalyticsQuery{
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
				QueryType:        dataquery.AzureQueryTypeLogAnalytics,
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
				QueryType: string(dataquery.AzureQueryTypeLogAnalytics),
			},
			azureLogAnalyticsQuery: new(AzureLogAnalyticsQuery{
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
				QueryType:        dataquery.AzureQueryTypeLogAnalytics,
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
				QueryType: string(dataquery.AzureQueryTypeLogAnalytics),
			},
			azureLogAnalyticsQuery: new(AzureLogAnalyticsQuery{
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
				QueryType:        dataquery.AzureQueryTypeLogAnalytics,
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
				QueryType: string(dataquery.AzureQueryTypeLogAnalytics),
			},
			azureLogAnalyticsQuery: new(AzureLogAnalyticsQuery{
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
				QueryType:        dataquery.AzureQueryTypeLogAnalytics,
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
				QueryType: string(dataquery.AzureQueryTypeLogAnalytics),
			},
			azureLogAnalyticsQuery: new(AzureLogAnalyticsQuery{
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
				QueryType:        dataquery.AzureQueryTypeLogAnalytics,
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
				QueryType: string(dataquery.AzureQueryTypeLogAnalytics),
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
				QueryType: string(dataquery.AzureQueryTypeLogAnalytics),
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
				QueryType: string(dataquery.AzureQueryTypeLogAnalytics),
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
				QueryType: string(dataquery.AzureQueryTypeLogAnalytics),
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
				QueryType: string(dataquery.AzureQueryTypeLogAnalytics),
			},
			azureLogAnalyticsQuery: new(AzureLogAnalyticsQuery{
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
				QueryType:        dataquery.AzureQueryTypeLogAnalytics,
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
				QueryType: string(dataquery.AzureQueryTypeLogAnalytics),
			},
			azureLogAnalyticsQuery: new(AzureLogAnalyticsQuery{
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
				QueryType:        dataquery.AzureQueryTypeLogAnalytics,
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
			QueryType:        dataquery.AzureQueryTypeLogAnalytics,
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
			QueryType: dataquery.AzureQueryTypeLogAnalytics,
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
			QueryType:        dataquery.AzureQueryTypeLogAnalytics,
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
			QueryType:        dataquery.AzureQueryTypeLogAnalytics,
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

	t.Run("correctly passes multiple application insights resources in a logs query", func(t *testing.T) {
		ds := AzureLogAnalyticsDatasource{}
		req, err := ds.createRequest(ctx, url, &AzureLogAnalyticsQuery{
			Resources:        []string{"/subscriptions/test-sub/resourceGroups/test-rg/providers/microsoft.insights/components/r1", "/subscriptions/test-sub/resourceGroups/test-rg/providers/microsoft.insights/components/r2"},
			Query:            "Perf",
			QueryType:        dataquery.AzureQueryTypeLogAnalytics,
			AppInsightsQuery: true,
			DashboardTime:    false,
		})
		require.NoError(t, err)
		expectedBody := `{"applications":["/subscriptions/test-sub/resourceGroups/test-rg/providers/microsoft.insights/components/r1","/subscriptions/test-sub/resourceGroups/test-rg/providers/microsoft.insights/components/r2"],"query":"Perf"}`
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		if !cmp.Equal(string(body), expectedBody) {
			t.Errorf("Unexpected Body: %v", cmp.Diff(string(body), expectedBody))
		}
	})

	t.Run("returns error for AppInsights traces query with empty resources", func(t *testing.T) {
		ds := AzureLogAnalyticsDatasource{}
		_, err := ds.createRequest(ctx, url, &AzureLogAnalyticsQuery{
			Resources:        []string{}, // Empty resources
			Query:            "traces",
			QueryType:        dataquery.AzureQueryTypeAzureTraces,
			AppInsightsQuery: true,
			DashboardTime:    false,
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "no resources specified for Azure traces Application Insights query")
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
	t.Run("errors with azureLogAnalyticsSameAs set to false (boolean)", func(t *testing.T) {
		_, err := ds.executeQuery(ctx, query, dsInfo, &http.Client{}, dsInfo.Services["Azure Log Analytics"].URL)
		if err == nil {
			t.Fatal("expecting an error")
		}
		if !strings.Contains(err.Error(), "credentials for Log Analytics are no longer supported") {
			t.Error("expecting the error to inform of bad credentials")
		}
	})

	t.Run("errors with azureLogAnalyticsSameAs set to false (boolean)", func(t *testing.T) {
		dsInfo.JSONData["azureLogAnalyticsSameAs"] = "false"
		_, err := ds.executeQuery(ctx, query, dsInfo, &http.Client{}, dsInfo.Services["Azure Log Analytics"].URL)
		if err == nil {
			t.Fatal("expecting an error")
		}
		if !strings.Contains(err.Error(), "credentials for Log Analytics are no longer supported") {
			t.Error("expecting the error to inform of bad credentials")
		}
	})
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
		ctx = config.WithGrafanaConfig(ctx, config.NewGrafanaCfg(map[string]string{"GF_INSTANCE_FEATURE_TOGGLES_ENABLE": "azureMonitorPrometheusExemplars"}))
		query := backend.DataQuery{
			JSON: []byte(`{
					"queryType": "traceql",
					"azureTraces": {
						"operationId": "traceid"
					},
					"query":     "traceid"
				}`),
			RefID:     "A",
			QueryType: string(dataquery.AzureQueryTypeTraceExemplar),
		}

		_, err := ds.buildQuery(ctx, query, dsInfo, false)

		require.NoError(t, err)
	})

	t.Run("errors if feature toggle disabled", func(t *testing.T) {
		ctx := context.Background()
		ctx = config.WithGrafanaConfig(ctx, config.NewGrafanaCfg(map[string]string{"GF_INSTANCE_FEATURE_TOGGLES_ENABLE": ""}))
		query := backend.DataQuery{
			JSON: []byte(`{
					"queryType": "traceql",
					"azureTraces": {
						"operationId": "traceid"
					},
					"query":     "traceid"
				}`),
			RefID:     "A",
			QueryType: string(dataquery.AzureQueryTypeTraceExemplar),
		}

		_, err := ds.buildQuery(ctx, query, dsInfo, false)

		require.Error(t, err, "query type unsupported as azureMonitorPrometheusExemplars feature toggle is not enabled")
	})
}

func TestAddTraceDataLinksToFields_EmptyResources(t *testing.T) {
	dsInfo := types.DatasourceInfo{
		Services: map[string]types.DatasourceService{
			"Azure Monitor": {},
		},
		JSONData: map[string]any{
			"azureLogAnalyticsSameAs": false,
		},
	}

	tests := []struct {
		name                string
		queryJSON           string
		expectedErrorString string
	}{
		{
			name: "empty resources array should return error",
			queryJSON: `{
				"queryType": "Azure Traces",
				"azureTraces": {
					"resources": [],
					"resultFormat": "table",
					"traceTypes": ["trace"]
				}
			}`,
			expectedErrorString: "no resources specified for Azure traces data link",
		},
		{
			name: "missing resources field should return error",
			queryJSON: `{
				"queryType": "Azure Traces",
				"azureTraces": {
					"resultFormat": "table",
					"traceTypes": ["trace"]
				}
			}`,
			expectedErrorString: "no resources specified for Azure traces data link",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := &AzureLogAnalyticsQuery{
				JSON:         []byte(tt.queryJSON),
				QueryType:    dataquery.AzureQueryTypeAzureTraces,
				ResultFormat: dataquery.ResultFormatTable,
			}

			// Create a mock data frame
			frame := data.NewFrame("test")

			err := addTraceDataLinksToFields(query, "https://portal.azure.com", frame, dsInfo)

			require.Error(t, err)
			require.Contains(t, err.Error(), tt.expectedErrorString)
		})
	}
}

func TestAddDataLinksToFields_TraceExemplar(t *testing.T) {
	dsInfo := types.DatasourceInfo{
		DatasourceUID:  "azure-monitor",
		DatasourceName: "Azure Monitor",
		Services: map[string]types.DatasourceService{
			"Azure Monitor": {},
		},
	}

	jsonResource := "/subscriptions/sub"
	resolvedResource := "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Insights/components/app"
	traceExploreQuery := "union isfuzzy=true AppTraces | where operation_Id == TraceId"
	parentExploreQuery := "union isfuzzy=true AppTraces | where operation_Id == TraceId | where id == ParentId"
	logsExploreQuery := "union isfuzzy=true AppTraces | where operation_Id == TraceId | project *"

	newExemplarQuery := func(resultFormat dataquery.ResultFormat) *AzureLogAnalyticsQuery {
		queryJSON := fmt.Sprintf(`{
			"queryType": "traceql",
			"azureTraces": {
				"resources": [%q],
				"resultFormat": %q,
				"operationId": "trace-id"
			}
		}`, jsonResource, resultFormat)
		return &AzureLogAnalyticsQuery{
			JSON:                    []byte(queryJSON),
			QueryType:               dataquery.AzureQueryTypeTraceExemplar,
			ResultFormat:            resultFormat,
			Resources:               []string{resolvedResource},
			TraceExploreQuery:       traceExploreQuery,
			TraceParentExploreQuery: parentExploreQuery,
			TraceLogsExploreQuery:   logsExploreQuery,
		}
	}

	newTraceFrame := func() *data.Frame {
		return data.NewFrame("trace",
			data.NewField("traceID", nil, []string{"trace-id"}),
			data.NewField("spanID", nil, []string{"span-id"}),
			data.NewField("operationName", nil, []string{"GET /"}),
			data.NewField("serviceName", nil, []string{"frontend"}),
			data.NewField("duration", nil, []float64{1.2}),
		)
	}

	t.Run("trace format does not attach portal query links to every field", func(t *testing.T) {
		frame := newTraceFrame()
		err := addDataLinksToFields(newExemplarQuery(dataquery.ResultFormatTrace), "https://portal.azure.com", frame, dsInfo, "https://portal.azure.com/query")
		require.NoError(t, err)

		require.Equal(t, 0, countFieldLinksByTitle(frame, "View query in Azure Portal"))
		require.Equal(t, 1, countFieldLinksByTitle(frame, "Explore Trace Logs"))
	})

	t.Run("explore links use Azure Traces query type and resolved resources", func(t *testing.T) {
		frame := newTraceFrame()
		err := addDataLinksToFields(newExemplarQuery(dataquery.ResultFormatTable), "https://portal.azure.com", frame, dsInfo, "https://portal.azure.com/query")
		require.NoError(t, err)

		exploreTrace := findInternalAzureQueryByLinkTitle(t, frame, "Explore Trace: ${__data.fields.traceID}")
		require.NotNil(t, exploreTrace.QueryType)
		require.Equal(t, string(dataquery.AzureQueryTypeAzureTraces), *exploreTrace.QueryType)
		require.NotNil(t, exploreTrace.AzureTraces)
		require.Equal(t, []string{resolvedResource}, exploreTrace.AzureTraces.Resources)
		require.NotNil(t, exploreTrace.AzureTraces.Query)
		require.Equal(t, traceExploreQuery, *exploreTrace.AzureTraces.Query)

		exploreParent := findInternalAzureQueryByLinkTitle(t, frame, "Explore Parent Span: ${__data.fields.parentSpanID}")
		require.NotNil(t, exploreParent.QueryType)
		require.Equal(t, string(dataquery.AzureQueryTypeAzureTraces), *exploreParent.QueryType)
		require.NotNil(t, exploreParent.AzureTraces)
		require.Equal(t, []string{resolvedResource}, exploreParent.AzureTraces.Resources)
		require.NotNil(t, exploreParent.AzureTraces.Query)
		require.Equal(t, parentExploreQuery, *exploreParent.AzureTraces.Query)

		exploreLogs := findInternalAzureQueryByLinkTitle(t, frame, "Explore Trace Logs")
		require.NotNil(t, exploreLogs.QueryType)
		require.Equal(t, string(dataquery.AzureQueryTypeLogAnalytics), *exploreLogs.QueryType)
		require.NotNil(t, exploreLogs.AzureLogAnalytics)
		require.Equal(t, []string{resolvedResource}, exploreLogs.AzureLogAnalytics.Resources)
	})
}

func countFieldLinksByTitle(frame *data.Frame, title string) int {
	count := 0
	for _, field := range frame.Fields {
		if field.Config == nil {
			continue
		}
		for _, link := range field.Config.Links {
			if link.Title == title {
				count++
			}
		}
	}
	return count
}

func findInternalAzureQueryByLinkTitle(t *testing.T, frame *data.Frame, title string) dataquery.AzureMonitorQuery {
	t.Helper()
	for _, field := range frame.Fields {
		if field.Config == nil {
			continue
		}
		for _, link := range field.Config.Links {
			if link.Title != title || link.Internal == nil {
				continue
			}
			query, ok := link.Internal.Query.(dataquery.AzureMonitorQuery)
			require.True(t, ok, "expected AzureMonitorQuery on link %q", title)
			return query
		}
	}
	require.FailNow(t, "link not found", "title %q", title)
	return dataquery.AzureMonitorQuery{}
}

func decodeEncodedQuery(t *testing.T, encoded string) string {
	t.Helper()
	gzipped, err := base64.StdEncoding.DecodeString(encoded)
	require.NoError(t, err)
	r, err := gzip.NewReader(bytes.NewReader(gzipped))
	require.NoError(t, err)
	defer func() { require.NoError(t, r.Close()) }()
	decoded, err := io.ReadAll(r)
	require.NoError(t, err)
	return string(decoded)
}

func TestEncodeQuery(t *testing.T) {
	cases := []struct {
		name  string
		query string
	}{
		{name: "empty", query: ""},
		{name: "simple", query: "Heartbeat | take 10"},
		{name: "multiline", query: "Heartbeat\n| where TimeGenerated > ago(1d)\n| summarize count() by Computer"},
		{name: "large", query: strings.Repeat("Heartbeat | where TimeGenerated > ago(1d) | summarize count() by Computer ", 50)},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			encoded, err := encodeQuery(tc.query)
			require.NoError(t, err)
			require.Equal(t, tc.query, decodeEncodedQuery(t, encoded))
		})
	}
}

func TestEncodeQueryConcurrent(t *testing.T) {
	// Exercises the gzip.Writer sync.Pool under contention: each goroutine
	// must produce output that decodes back to its own input.
	const goroutines = 64
	const iterations = 32

	var wg sync.WaitGroup
	wg.Add(goroutines)
	for g := 0; g < goroutines; g++ {
		go func(g int) {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				query := fmt.Sprintf("Heartbeat | where Computer == 'c-%d-%d' | take 10", g, i)
				encoded, err := encodeQuery(query)
				require.NoError(t, err)
				require.Equal(t, query, decodeEncodedQuery(t, encoded))
			}
		}(g)
	}
	wg.Wait()
}

func BenchmarkEncodeQuery(b *testing.B) {
	query := strings.Repeat("Heartbeat | where TimeGenerated > ago(1d) | summarize count() by Computer ", 20)
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		if _, err := encodeQuery(query); err != nil {
			b.Fatal(err)
		}
	}
}
