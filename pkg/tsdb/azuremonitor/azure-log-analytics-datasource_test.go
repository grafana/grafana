package azuremonitor

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/url"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/require"
)

func TestBuildingAzureLogAnalyticsQueries(t *testing.T) {
	datasource := &AzureLogAnalyticsDatasource{}
	fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)

	tests := []struct {
		name                     string
		queryModel               []*tsdb.Query
		timeRange                *tsdb.TimeRange
		azureLogAnalyticsQueries []*AzureLogAnalyticsQuery
		Err                      require.ErrorAssertionFunc
	}{
		{
			name: "Query with macros should be interpolated",
			timeRange: &tsdb.TimeRange{
				From: fmt.Sprintf("%v", fromStart.Unix()*1000),
				To:   fmt.Sprintf("%v", fromStart.Add(34*time.Minute).Unix()*1000),
			},
			queryModel: []*tsdb.Query{
				{
					DataSource: &models.DataSource{
						JsonData: simplejson.NewFromAny(map[string]interface{}{}),
					},
					Model: simplejson.NewFromAny(map[string]interface{}{
						"queryType": "Azure Log Analytics",
						"azureLogAnalytics": map[string]interface{}{
							"workspace":    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
							"query":        "query=Perf | where $__timeFilter() | where $__contains(Computer, 'comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer",
							"resultFormat": "time_series",
						},
					}),
					RefId: "A",
				},
			},
			azureLogAnalyticsQueries: []*AzureLogAnalyticsQuery{
				{
					RefID:        "A",
					ResultFormat: "time_series",
					URL:          "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/query",
					Model: simplejson.NewFromAny(map[string]interface{}{
						"azureLogAnalytics": map[string]interface{}{
							"query":        "query=Perf | where $__timeFilter() | where $__contains(Computer, 'comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer",
							"resultFormat": "time_series",
							"workspace":    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
						},
					}),
					Params: url.Values{"query": {"query=Perf | where ['TimeGenerated'] >= datetime('2018-03-15T13:00:00Z') and ['TimeGenerated'] <= datetime('2018-03-15T13:34:00Z') | where ['Computer'] in ('comp1','comp2') | summarize avg(CounterValue) by bin(TimeGenerated, 34000ms), Computer"}},
					Target: "query=query%3DPerf+%7C+where+%5B%27TimeGenerated%27%5D+%3E%3D+datetime%28%272018-03-15T13%3A00%3A00Z%27%29+and+%5B%27TimeGenerated%27%5D+%3C%3D+datetime%28%272018-03-15T13%3A34%3A00Z%27%29+%7C+where+%5B%27Computer%27%5D+in+%28%27comp1%27%2C%27comp2%27%29+%7C+summarize+avg%28CounterValue%29+by+bin%28TimeGenerated%2C+34000ms%29%2C+Computer",
				},
			},
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			queries, err := datasource.buildQueries(tt.queryModel, tt.timeRange)
			tt.Err(t, err)
			if diff := cmp.Diff(tt.azureLogAnalyticsQueries, queries, cmpopts.IgnoreUnexported(simplejson.Json{})); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestParsingAzureLogAnalyticsResponses(t *testing.T) {
	datasource := &AzureLogAnalyticsDatasource{}
	tests := []struct {
		name     string
		testFile string
		query    string
		series   tsdb.TimeSeriesSlice
		meta     string
		Err      require.ErrorAssertionFunc
	}{
		{
			name:     "Response with single series should be parsed into the Grafana time series format",
			testFile: "loganalytics/1-log-analytics-response-metrics-single-series.json",
			query:    "test query",
			series: tsdb.TimeSeriesSlice{
				&tsdb.TimeSeries{
					Name: "grafana-vm",
					Points: tsdb.TimeSeriesPoints{
						{null.FloatFrom(1.1), null.FloatFrom(1587323766000)},
						{null.FloatFrom(2.2), null.FloatFrom(1587323776000)},
						{null.FloatFrom(3.3), null.FloatFrom(1587323786000)},
					},
				},
			},
			meta: `{"columns":[{"name":"TimeGenerated","type":"datetime"},{"name":"Computer","type":"string"},{"name":"avg_CounterValue","type":"real"}],"subscription":"1234","workspace":"aworkspace","query":"test query","encodedQuery":"H4sIAAAAAAAA/ypJLS5RKCxNLaoEBAAA///0rBfVCgAAAA=="}`,
			Err:  require.NoError,
		},
		{
			name:     "Response with multiple series should be parsed into the Grafana time series format",
			testFile: "loganalytics/2-log-analytics-response-metrics-multiple-series.json",
			query:    "test query",
			series: tsdb.TimeSeriesSlice{
				&tsdb.TimeSeries{
					Name: "Processor",
					Points: tsdb.TimeSeriesPoints{
						{null.FloatFrom(0.75), null.FloatFrom(1587418800000)},
						{null.FloatFrom(1.0055555555555555), null.FloatFrom(1587419100000)},
						{null.FloatFrom(0.7407407407407407), null.FloatFrom(1587419400000)},
					},
				},
				&tsdb.TimeSeries{
					Name: "Logical Disk",
					Points: tsdb.TimeSeriesPoints{
						{null.FloatFrom(16090.551851851851), null.FloatFrom(1587418800000)},
						{null.FloatFrom(16090.537037037036), null.FloatFrom(1587419100000)},
						{null.FloatFrom(16090.586419753086), null.FloatFrom(1587419400000)},
					},
				},
				&tsdb.TimeSeries{
					Name: "Memory",
					Points: tsdb.TimeSeriesPoints{
						{null.FloatFrom(702.0666666666667), null.FloatFrom(1587418800000)},
						{null.FloatFrom(700.5888888888888), null.FloatFrom(1587419100000)},
						{null.FloatFrom(703.1111111111111), null.FloatFrom(1587419400000)},
					},
				},
			},
			meta: `{"columns":[{"name":"TimeGenerated","type":"datetime"},{"name":"ObjectName","type":"string"},{"name":"avg_CounterValue","type":"real"}],"subscription":"1234","workspace":"aworkspace","query":"test query","encodedQuery":"H4sIAAAAAAAA/ypJLS5RKCxNLaoEBAAA///0rBfVCgAAAA=="}`,
			Err:  require.NoError,
		},
		{
			name:     "Response with no metric name column should use the value column name as the series name",
			testFile: "loganalytics/3-log-analytics-response-metrics-no-metric-column.json",
			query:    "test query",
			series: tsdb.TimeSeriesSlice{
				&tsdb.TimeSeries{
					Name: "avg_CounterValue",
					Points: tsdb.TimeSeriesPoints{
						{null.FloatFrom(1), null.FloatFrom(1587323766000)},
						{null.FloatFrom(2), null.FloatFrom(1587323776000)},
						{null.FloatFrom(3), null.FloatFrom(1587323786000)},
					},
				},
			},
			meta: `{"columns":[{"name":"TimeGenerated","type":"datetime"},{"name":"avg_CounterValue","type":"int"}],"subscription":"1234","workspace":"aworkspace","query":"test query","encodedQuery":"H4sIAAAAAAAA/ypJLS5RKCxNLaoEBAAA///0rBfVCgAAAA=="}`,
			Err:  require.NoError,
		},
		{
			name:     "Response with no time column should return no data",
			testFile: "loganalytics/4-log-analytics-response-metrics-no-time-column.json",
			query:    "test query",
			series:   nil,
			meta:     `{"columns":[{"name":"Computer","type":"string"},{"name":"avg_CounterValue","type":"real"}],"subscription":"1234","workspace":"aworkspace","query":"test query","encodedQuery":"H4sIAAAAAAAA/ypJLS5RKCxNLaoEBAAA///0rBfVCgAAAA=="}`,
			Err:      require.NoError,
		},
		{
			name:     "Response with no value column should return no data",
			testFile: "loganalytics/5-log-analytics-response-metrics-no-value-column.json",
			query:    "test query",
			series:   nil,
			meta:     `{"columns":[{"name":"TimeGenerated","type":"datetime"},{"name":"Computer","type":"string"}],"subscription":"1234","workspace":"aworkspace","query":"test query","encodedQuery":"H4sIAAAAAAAA/ypJLS5RKCxNLaoEBAAA///0rBfVCgAAAA=="}`,
			Err:      require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, _ := loadLogAnalyticsTestFile(tt.testFile)

			model := simplejson.NewFromAny(map[string]interface{}{
				"subscriptionId": "1234",
				"azureLogAnalytics": map[string]interface{}{
					"workspace": "aworkspace",
				},
			})
			params := url.Values{}
			params.Add("query", tt.query)
			series, meta, err := datasource.parseToTimeSeries(data, model, params)
			tt.Err(t, err)

			if diff := cmp.Diff(tt.series, series, cmpopts.EquateNaNs()); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			json, _ := json.Marshal(meta)
			cols := string(json)

			if diff := cmp.Diff(tt.meta, cols, cmpopts.EquateNaNs()); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestParsingAzureLogAnalyticsTableResponses(t *testing.T) {
	datasource := &AzureLogAnalyticsDatasource{}
	tests := []struct {
		name     string
		testFile string
		query    string
		tables   []*tsdb.Table
		meta     string
		Err      require.ErrorAssertionFunc
	}{
		{
			name:     "Table data should be parsed into the table format Response",
			testFile: "loganalytics/6-log-analytics-response-table.json",
			query:    "test query",
			tables: []*tsdb.Table{
				{
					Columns: []tsdb.TableColumn{
						{Text: "TenantId"},
						{Text: "Computer"},
						{Text: "ObjectName"},
						{Text: "CounterName"},
						{Text: "InstanceName"},
						{Text: "Min"},
						{Text: "Max"},
						{Text: "SampleCount"},
						{Text: "CounterValue"},
						{Text: "TimeGenerated"},
					},
					Rows: []tsdb.RowValues{
						{
							string("a2c1b44e-3e57-4410-b027-6cc0ae6dee67"),
							string("grafana-vm"),
							string("Memory"),
							string("Available MBytes Memory"),
							string("Memory"),
							nil,
							nil,
							nil,
							float64(2040),
							string("2020-04-23T11:46:03.857Z"),
						},
						{
							string("a2c1b44e-3e57-4410-b027-6cc0ae6dee67"),
							string("grafana-vm"),
							string("Memory"),
							string("Available MBytes Memory"),
							string("Memory"),
							nil,
							nil,
							nil,
							float64(2066),
							string("2020-04-23T11:46:13.857Z"),
						},
						{
							string("a2c1b44e-3e57-4410-b027-6cc0ae6dee67"),
							string("grafana-vm"),
							string("Memory"),
							string("Available MBytes Memory"),
							string("Memory"),
							nil,
							nil,
							nil,
							float64(2066),
							string("2020-04-23T11:46:23.857Z"),
						},
					},
				},
			},
			meta: `{"columns":[{"name":"TenantId","type":"string"},{"name":"Computer","type":"string"},{"name":"ObjectName","type":"string"},{"name":"CounterName","type":"string"},` +
				`{"name":"InstanceName","type":"string"},{"name":"Min","type":"real"},{"name":"Max","type":"real"},{"name":"SampleCount","type":"int"},{"name":"CounterValue","type":"real"},` +
				`{"name":"TimeGenerated","type":"datetime"}],"subscription":"1234","workspace":"aworkspace","query":"test query","encodedQuery":"H4sIAAAAAAAA/ypJLS5RKCxNLaoEBAAA///0rBfVCgAAAA=="}`,
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, _ := loadLogAnalyticsTestFile(tt.testFile)

			model := simplejson.NewFromAny(map[string]interface{}{
				"subscriptionId": "1234",
				"azureLogAnalytics": map[string]interface{}{
					"workspace": "aworkspace",
				},
			})
			params := url.Values{}
			params.Add("query", tt.query)
			tables, meta, err := datasource.parseToTables(data, model, params)
			tt.Err(t, err)

			if diff := cmp.Diff(tt.tables, tables, cmpopts.EquateNaNs()); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			json, _ := json.Marshal(meta)
			cols := string(json)

			if diff := cmp.Diff(tt.meta, cols, cmpopts.EquateNaNs()); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

		})
	}
}

func TestPluginRoutes(t *testing.T) {
	datasource := &AzureLogAnalyticsDatasource{}
	plugin := &plugins.DataSourcePlugin{
		Routes: []*plugins.AppPluginRoute{
			{
				Path:   "loganalyticsazure",
				Method: "GET",
				URL:    "https://api.loganalytics.io/v1/workspaces",
				Headers: []plugins.AppPluginRouteHeader{
					{Name: "x-ms-app", Content: "Grafana"},
				},
			},
			{
				Path:   "chinaloganalyticsazure",
				Method: "GET",
				URL:    "https://api.loganalytics.azure.cn/v1/workspaces",
				Headers: []plugins.AppPluginRouteHeader{
					{Name: "x-ms-app", Content: "Grafana"},
				},
			},
			{
				Path:   "govloganalyticsazure",
				Method: "GET",
				URL:    "https://api.loganalytics.us/v1/workspaces",
				Headers: []plugins.AppPluginRouteHeader{
					{Name: "x-ms-app", Content: "Grafana"},
				},
			},
		},
	}

	tests := []struct {
		name              string
		cloudName         string
		expectedProxypass string
		expectedRouteURL  string
		Err               require.ErrorAssertionFunc
	}{
		{
			name:              "plugin proxy route for the Azure public cloud",
			cloudName:         "azuremonitor",
			expectedProxypass: "loganalyticsazure",
			expectedRouteURL:  "https://api.loganalytics.io/v1/workspaces",
			Err:               require.NoError,
		},
		{
			name:              "plugin proxy route for the Azure China cloud",
			cloudName:         "chinaazuremonitor",
			expectedProxypass: "chinaloganalyticsazure",
			expectedRouteURL:  "https://api.loganalytics.azure.cn/v1/workspaces",
			Err:               require.NoError,
		},
		{
			name:              "plugin proxy route for the Azure Gov cloud",
			cloudName:         "govazuremonitor",
			expectedProxypass: "govloganalyticsazure",
			expectedRouteURL:  "https://api.loganalytics.us/v1/workspaces",
			Err:               require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			route, proxypass, err := datasource.getPluginRoute(plugin, tt.cloudName)
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

func loadLogAnalyticsTestFile(name string) (AzureLogAnalyticsResponse, error) {
	var data AzureLogAnalyticsResponse

	path := filepath.Join("testdata", name)
	jsonBody, err := ioutil.ReadFile(path)
	if err != nil {
		return data, err
	}
	err = json.Unmarshal(jsonBody, &data)
	return data, err
}
