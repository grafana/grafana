package loganalytics

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

var logger = log.New("test")

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
							"query":        "Perf | where $__timeFilter() | where $__contains(Computer, 'comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					RefID:     "A",
					TimeRange: timeRange,
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: types.TimeSeries,
					URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace/query",
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf | where $__timeFilter() | where $__contains(Computer, 'comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					Query:     "Perf | where ['TimeGenerated'] >= datetime('2018-03-15T13:00:00Z') and ['TimeGenerated'] <= datetime('2018-03-15T13:34:00Z') | where ['Computer'] in ('comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, 34000ms), Computer",
					Resources: []string{"/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace"},
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
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					RefID: "A",
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: types.TimeSeries,
					URL:          "v1/workspaces/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/query",
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"workspace":    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					Query:     "Perf",
					Resources: []string{},
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
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					RefID: "A",
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: types.TimeSeries,
					URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace/query",
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"workspace":    "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					Query:     "Perf",
					Resources: []string{},
				},
			},
			Err: require.NoError,
		},

		{
			name: "Queries with multiple resources",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					RefID: "A",
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: types.TimeSeries,
					URL:          "v1/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace/query",
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resource":     "/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace",
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					Query:     "Perf",
					Resources: []string{"/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.OperationalInsights/workspaces/AppInsightsTestDataWorkspace"},
				},
			},
			Err: require.NoError,
		},
		{
			name: "Query with multiple resources",
			queryModel: []backend.DataQuery{
				{
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/r1","/subscriptions/r2"],
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					RefID:     "A",
					TimeRange: timeRange,
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: types.TimeSeries,
					URL:          "v1/subscriptions/r1/query",
					JSON: []byte(fmt.Sprintf(`{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": {
							"resources":     ["/subscriptions/r1","/subscriptions/r2"],
							"query":        "Perf",
							"resultFormat": "%s"
						}
					}`, types.TimeSeries)),
					Query:     "Perf",
					Resources: []string{"/subscriptions/r1", "/subscriptions/r2"},
					TimeRange: timeRange,
				},
			},
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			queries, err := datasource.buildQueries(logger, tt.queryModel, types.DatasourceInfo{})
			tt.Err(t, err)
			if diff := cmp.Diff(tt.azureLogAnalyticsQueries[0], queries[0]); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestLogAnalyticsCreateRequest(t *testing.T) {
	ctx := context.Background()
	url := "http://ds/"

	t.Run("creates a request", func(t *testing.T) {
		ds := AzureLogAnalyticsDatasource{}
		req, err := ds.createRequest(ctx, logger, url, &AzureLogAnalyticsQuery{
			Resources: []string{"r"},
			Query:     "Perf",
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
		req, err := ds.createRequest(ctx, logger, url, &AzureLogAnalyticsQuery{
			Resources: []string{"r1", "r2"},
			Query:     "Perf",
		})
		require.NoError(t, err)
		expectedBody := `{"query":"Perf","resources":["r1","r2"]}`
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
		JSONData: map[string]interface{}{
			"azureLogAnalyticsSameAs": false,
		},
	}
	ctx := context.Background()
	query := &AzureLogAnalyticsQuery{
		TimeRange: backend.TimeRange{},
	}
	tracer := tracing.InitializeTracerForTest()
	res := ds.executeQuery(ctx, logger, query, dsInfo, &http.Client{}, dsInfo.Services["Azure Log Analytics"].URL, tracer)
	if res.Error == nil {
		t.Fatal("expecting an error")
	}
	if !strings.Contains(res.Error.Error(), "credentials for Log Analytics are no longer supported") {
		t.Error("expecting the error to inform of bad credentials")
	}
}
