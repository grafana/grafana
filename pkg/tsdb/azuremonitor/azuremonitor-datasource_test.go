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
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/require"
)

func TestAzureMonitorBuildQueries(t *testing.T) {
	datasource := &AzureMonitorDatasource{}
	fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)

	tests := []struct {
		name                         string
		azureMonitorVariedProperties map[string]interface{}
		azureMonitorQueryTarget      string
		expectedInterval             string
		queryIntervalMS              int64
	}{
		{
			name: "Parse queries from frontend and build AzureMonitor API queries",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain": "PT1M",
				"top":       "10",
			},
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2018-01-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute-virtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z",
		},
		{
			name: "time grain set to auto",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain": "auto",
				"top":       "10",
			},
			queryIntervalMS:         400000,
			expectedInterval:        "PT15M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2018-01-01&interval=PT15M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute-virtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z",
		},
		{
			name: "time grain set to auto",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain":           "auto",
				"allowedTimeGrainsMs": []int64{60000, 300000},
				"top":                 "10",
			},
			queryIntervalMS:         400000,
			expectedInterval:        "PT5M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2018-01-01&interval=PT5M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute-virtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z",
		},
		{
			name: "has a dimension filter",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain":       "PT1M",
				"dimension":       "blob",
				"dimensionFilter": "*",
				"top":             "30",
			},
			queryIntervalMS:         400000,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "%24filter=blob+eq+%27%2A%27&aggregation=Average&api-version=2018-01-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute-virtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z&top=30",
		},
		{
			name: "has a dimension filter",
			azureMonitorVariedProperties: map[string]interface{}{
				"timeGrain":       "PT1M",
				"dimension":       "None",
				"dimensionFilter": "*",
				"top":             "10",
			},
			queryIntervalMS:         400000,
			expectedInterval:        "PT1M",
			azureMonitorQueryTarget: "aggregation=Average&api-version=2018-01-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute-virtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z",
		},
	}

	commonAzureModelProps := map[string]interface{}{
		"aggregation":      "Average",
		"resourceGroup":    "grafanastaging",
		"resourceName":     "grafana",
		"metricDefinition": "Microsoft.Compute/virtualMachines",
		"metricNamespace":  "Microsoft.Compute-virtualMachines",
		"metricName":       "Percentage CPU",

		"alias":     "testalias",
		"queryType": "Azure Monitor",
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			for k, v := range commonAzureModelProps {
				tt.azureMonitorVariedProperties[k] = v
			}
			tsdbQuery := &tsdb.TsdbQuery{
				TimeRange: &tsdb.TimeRange{
					From: fmt.Sprintf("%v", fromStart.Unix()*1000),
					To:   fmt.Sprintf("%v", fromStart.Add(34*time.Minute).Unix()*1000),
				},
				Queries: []*tsdb.Query{
					{
						DataSource: &models.DataSource{
							JsonData: simplejson.NewFromAny(map[string]interface{}{
								"subscriptionId": "default-subscription",
							}),
						},
						Model: simplejson.NewFromAny(map[string]interface{}{
							"subscription": "12345678-aaaa-bbbb-cccc-123456789abc",
							"azureMonitor": tt.azureMonitorVariedProperties,
						},
						),
						RefId:      "A",
						IntervalMs: tt.queryIntervalMS,
					},
				},
			}

			azureMonitorQuery := &AzureMonitorQuery{
				URL: "12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics",
				UrlComponents: map[string]string{
					"metricDefinition": "Microsoft.Compute/virtualMachines",
					"resourceGroup":    "grafanastaging",
					"resourceName":     "grafana",
					"subscription":     "12345678-aaaa-bbbb-cccc-123456789abc",
				},
				Target: tt.azureMonitorQueryTarget,
				RefID:  "A",
				Alias:  "testalias",
			}

			queries, err := datasource.buildQueries(tsdbQuery.Queries, tsdbQuery.TimeRange)
			if err != nil {
				t.Error(err)
			}
			if diff := cmp.Diff(azureMonitorQuery, queries[0], cmpopts.IgnoreUnexported(simplejson.Json{}), cmpopts.IgnoreFields(AzureMonitorQuery{}, "Params")); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func makeDates(startDate time.Time, count int, interval time.Duration) (times []time.Time) {
	for i := 0; i < count; i++ {
		times = append(times, startDate.Add(interval*time.Duration(i)))
	}
	return
}

func TestAzureMonitorParseResponse(t *testing.T) {
	tests := []struct {
		name            string
		responseFile    string
		mockQuery       *AzureMonitorQuery
		expectedFrames  data.Frames
		queryIntervalMS int64
	}{
		{
			name:         "average aggregate time series response",
			responseFile: "1-azure-monitor-response-avg.json",
			mockQuery: &AzureMonitorQuery{
				UrlComponents: map[string]string{
					"resourceName": "grafana",
				},
				Params: url.Values{
					"aggregation": {"Average"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("", nil,
						makeDates(time.Date(2019, 2, 8, 10, 13, 0, 0, time.UTC), 5, time.Minute)),
					data.NewField("grafana.Percentage CPU", nil, []float64{
						2.0875, 2.1525, 2.155, 3.6925, 2.44,
					}).SetConfig(&data.FieldConfig{Unit: "Percent"})),
			},
		},
		{
			name:         "total aggregate time series response",
			responseFile: "2-azure-monitor-response-total.json",
			mockQuery: &AzureMonitorQuery{
				UrlComponents: map[string]string{
					"resourceName": "grafana",
				},
				Params: url.Values{
					"aggregation": {"Total"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("", nil,
						makeDates(time.Date(2019, 2, 9, 13, 29, 0, 0, time.UTC), 5, time.Minute)),
					data.NewField("grafana.Percentage CPU", nil, []float64{
						8.26, 8.7, 14.82, 10.07, 8.52,
					}).SetConfig(&data.FieldConfig{Unit: "Percent"})),
			},
		},
		{
			name:         "maximum aggregate time series response",
			responseFile: "3-azure-monitor-response-maximum.json",
			mockQuery: &AzureMonitorQuery{
				UrlComponents: map[string]string{
					"resourceName": "grafana",
				},
				Params: url.Values{
					"aggregation": {"Maximum"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("", nil,
						makeDates(time.Date(2019, 2, 9, 14, 26, 0, 0, time.UTC), 5, time.Minute)),
					data.NewField("grafana.Percentage CPU", nil, []float64{
						3.07, 2.92, 2.87, 2.27, 2.52,
					}).SetConfig(&data.FieldConfig{Unit: "Percent"})),
			},
		},
		{
			name:         "minimum aggregate time series response",
			responseFile: "4-azure-monitor-response-minimum.json",
			mockQuery: &AzureMonitorQuery{
				UrlComponents: map[string]string{
					"resourceName": "grafana",
				},
				Params: url.Values{
					"aggregation": {"Minimum"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("", nil,
						makeDates(time.Date(2019, 2, 9, 14, 43, 0, 0, time.UTC), 5, time.Minute)),
					data.NewField("grafana.Percentage CPU", nil, []float64{
						1.51, 2.38, 1.69, 2.27, 1.96,
					}).SetConfig(&data.FieldConfig{Unit: "Percent"})),
			},
		},
		{
			name:         "count aggregate time series response",
			responseFile: "5-azure-monitor-response-count.json",
			mockQuery: &AzureMonitorQuery{
				UrlComponents: map[string]string{
					"resourceName": "grafana",
				},
				Params: url.Values{
					"aggregation": {"Count"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("", nil,
						makeDates(time.Date(2019, 2, 9, 14, 44, 0, 0, time.UTC), 5, time.Minute)),
					data.NewField("grafana.Percentage CPU", nil, []float64{
						4, 4, 4, 4, 4,
					}).SetConfig(&data.FieldConfig{Unit: "Percent"})),
			},
		},
		{
			name:         "multi dimension time series response",
			responseFile: "6-azure-monitor-response-multi-dimension.json",
			mockQuery: &AzureMonitorQuery{
				UrlComponents: map[string]string{
					"resourceName": "grafana",
				},
				Params: url.Values{
					"aggregation": {"Average"},
				},
			},
			// Regarding multi-dimensional response:
			// - It seems they all share the same time index, so maybe can be a wide frame.
			// - Due to the type for the Azure monitor response, nulls currently become 0.
			// - blogtype=X should maybe become labels.
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("", nil,
						makeDates(time.Date(2019, 2, 9, 15, 21, 0, 0, time.UTC), 6, time.Hour)),
					data.NewField("grafana{blobtype=PageBlob}.Blob Count", nil, []float64{
						3, 3, 3, 3, 3, 0,
					}).SetConfig(&data.FieldConfig{Unit: "Count"})),

				data.NewFrame("",
					data.NewField("", nil,
						makeDates(time.Date(2019, 2, 9, 15, 21, 0, 0, time.UTC), 6, time.Hour)),
					data.NewField("grafana{blobtype=BlockBlob}.Blob Count", nil, []float64{
						1, 1, 1, 1, 1, 0,
					}).SetConfig(&data.FieldConfig{Unit: "Count"})),

				data.NewFrame("",
					data.NewField("", nil,
						makeDates(time.Date(2019, 2, 9, 15, 21, 0, 0, time.UTC), 6, time.Hour)),
					data.NewField("grafana{blobtype=Azure Data Lake Storage}.Blob Count", nil, []float64{
						0, 0, 0, 0, 0, 0,
					}).SetConfig(&data.FieldConfig{Unit: "Count"})),
			},
		},
		{
			name:         "with alias patterns in the query",
			responseFile: "2-azure-monitor-response-total.json",
			mockQuery: &AzureMonitorQuery{
				Alias: "custom {{resourcegroup}} {{namespace}} {{resourceName}} {{metric}}",
				UrlComponents: map[string]string{
					"resourceName": "grafana",
				},
				Params: url.Values{
					"aggregation": {"Total"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("", nil,
						makeDates(time.Date(2019, 2, 9, 13, 29, 0, 0, time.UTC), 5, time.Minute)),
					data.NewField("custom grafanastaging Microsoft.Compute/virtualMachines grafana Percentage CPU", nil, []float64{
						8.26, 8.7, 14.82, 10.07, 8.52,
					}).SetConfig(&data.FieldConfig{Unit: "Percent"})),
			},
		},
		{
			name:         "multi dimension with alias",
			responseFile: "6-azure-monitor-response-multi-dimension.json",
			mockQuery: &AzureMonitorQuery{
				Alias: "{{dimensionname}}={{DimensionValue}}",
				UrlComponents: map[string]string{
					"resourceName": "grafana",
				},
				Params: url.Values{
					"aggregation": {"Average"},
				},
			},
			expectedFrames: data.Frames{
				data.NewFrame("",
					data.NewField("", nil,
						makeDates(time.Date(2019, 2, 9, 15, 21, 0, 0, time.UTC), 6, time.Hour)),
					data.NewField("blobtype=PageBlob", nil, []float64{
						3, 3, 3, 3, 3, 0,
					}).SetConfig(&data.FieldConfig{Unit: "Count"})),

				data.NewFrame("",
					data.NewField("", nil,
						makeDates(time.Date(2019, 2, 9, 15, 21, 0, 0, time.UTC), 6, time.Hour)),
					data.NewField("blobtype=BlockBlob", nil, []float64{
						1, 1, 1, 1, 1, 0,
					}).SetConfig(&data.FieldConfig{Unit: "Count"})),

				data.NewFrame("",
					data.NewField("", nil,
						makeDates(time.Date(2019, 2, 9, 15, 21, 0, 0, time.UTC), 6, time.Hour)),
					data.NewField("blobtype=Azure Data Lake Storage", nil, []float64{
						0, 0, 0, 0, 0, 0,
					}).SetConfig(&data.FieldConfig{Unit: "Count"})),
			},
		},
	}

	datasource := &AzureMonitorDatasource{}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			azData, err := loadTestFile("azuremonitor/" + tt.responseFile)
			require.NoError(t, err)
			res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
			err = datasource.parseResponse(res, azData, tt.mockQuery)
			require.NoError(t, err)

			frames, err := res.Dataframes.Decoded()
			require.NoError(t, err)
			if diff := cmp.Diff(tt.expectedFrames, frames, data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFindClosestAllowIntervalMS(t *testing.T) {
	humanIntervalToMS := map[string]int64{
		"3m":  180000,
		"5m":  300000,
		"10m": 600000,
		"15m": 900000,
		"1d":  86400000,
		"2d":  172800000,
	}
	tests := []struct {
		name              string
		allowedTimeGrains []int64 // Note: Uses defaults when empty list
		inputInterval     int64
		expectedInterval  int64
	}{
		{
			name:              "closest to 3m is 5m",
			allowedTimeGrains: []int64{},
			inputInterval:     humanIntervalToMS["3m"],
			expectedInterval:  humanIntervalToMS["5m"],
		},
		{
			name:              "closest to 10m is 15m",
			allowedTimeGrains: []int64{},
			inputInterval:     humanIntervalToMS["10m"],
			expectedInterval:  humanIntervalToMS["15m"],
		},
		{
			name:              "closest to 2d is 1d",
			allowedTimeGrains: []int64{},
			inputInterval:     humanIntervalToMS["2d"],
			expectedInterval:  humanIntervalToMS["1d"],
		},
		{
			name:              "closest to 3m is 1d when 1d is only allowed interval",
			allowedTimeGrains: []int64{humanIntervalToMS["1d"]},
			inputInterval:     humanIntervalToMS["2d"],
			expectedInterval:  humanIntervalToMS["1d"],
		},
	}
	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			interval := findClosestAllowedIntervalMS(tt.inputInterval, tt.allowedTimeGrains)
			require.Equal(t, tt.expectedInterval, interval)
		})
	}
}

func loadTestFile(name string) (AzureMonitorResponse, error) {
	var azData AzureMonitorResponse

	path := filepath.Join("testdata", name)
	jsonBody, err := ioutil.ReadFile(path)
	if err != nil {
		return azData, err
	}
	err = json.Unmarshal(jsonBody, &azData)
	return azData, err
}
