package azuremonitor

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/url"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
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
					RefID:  "A",
					URL:    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/query",
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
			if diff := cmp.Diff(tt.azureLogAnalyticsQueries, queries, cmpopts.EquateNaNs()); diff != "" {
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
		query    *AzureLogAnalyticsQuery
		series   tsdb.TimeSeriesSlice
		meta     string
		Err      require.ErrorAssertionFunc
	}{
		{
			name:     "Query with macros should be interpolated",
			testFile: "./test-data/loganalytics/1-log-analytics-response-metrics.json",
			query:    &AzureLogAnalyticsQuery{},
			series:   tsdb.TimeSeriesSlice{},
			meta:     `{"columns":["TimeGenerated","Computer","avg_CounterValue"]}`,
			Err:      require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, _ := loadLogAnalyticsTestFile(tt.testFile)
			series, meta, err := datasource.parseResponse(data, tt.query)
			tt.Err(t, err)

			json, _ := json.Marshal(meta)
			cols := string(json)

			if diff := cmp.Diff(tt.meta, cols, cmpopts.EquateNaNs()); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tt.series, series, cmpopts.EquateNaNs()); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func loadLogAnalyticsTestFile(path string) (AzureLogAnalyticsResponse, error) {
	var data AzureLogAnalyticsResponse

	jsonBody, err := ioutil.ReadFile(path)
	if err != nil {
		return data, err
	}
	err = json.Unmarshal(jsonBody, &data)
	return data, err
}
