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

	. "github.com/smartystreets/goconvey/convey"
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

func TestAzureMonitorDatasource(t *testing.T) {
	Convey("AzureMonitorDatasource", t, func() {
		datasource := &AzureMonitorDatasource{}

		Convey("Parse AzureMonitor API response in the time series format", func() {
			Convey("when data from query aggregated as average to one time series", func() {
				azData, err := loadTestFile("azuremonitor/1-azure-monitor-response-avg.json")
				So(err, ShouldBeNil)
				So(azData.Interval, ShouldEqual, "PT1M")

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &AzureMonitorQuery{
					UrlComponents: map[string]string{
						"resourceName": "grafana",
					},
					Params: url.Values{
						"aggregation": {"Average"},
					},
				}
				err = datasource.parseResponse(res, azData, query)
				So(err, ShouldBeNil)

				So(len(res.Dataframes), ShouldEqual, 1)
				frames, err := data.UnmarshalArrowFrames(res.Dataframes)
				So(err, ShouldBeNil)
				So(len(frames), ShouldEqual, 1)
				frame := frames[0]

				So(frame.Fields[1].Name, ShouldEqual, "grafana.Percentage CPU")
				So(frame.Fields[0].Len(), ShouldEqual, 5)

				So(frame.At(0, 0), ShouldEqual, time.Date(2019, 2, 8, 10, 13, 0, 0, time.UTC))
				So(frame.At(1, 0), ShouldEqual, 2.0875)

				So(frame.At(0, 1), ShouldEqual, time.Date(2019, 2, 8, 10, 14, 0, 0, time.UTC))
				So(frame.At(1, 1), ShouldEqual, 2.1525)

				So(frame.At(0, 2), ShouldEqual, time.Date(2019, 2, 8, 10, 15, 0, 0, time.UTC))
				So(frame.At(1, 2), ShouldEqual, 2.155)

				So(frame.At(0, 3), ShouldEqual, time.Date(2019, 2, 8, 10, 16, 0, 0, time.UTC))
				So(frame.At(1, 3), ShouldEqual, 3.6925)

				So(frame.At(0, 4), ShouldEqual, time.Date(2019, 2, 8, 10, 17, 0, 0, time.UTC))
				So(frame.At(1, 4), ShouldEqual, 2.44)
			})

			Convey("when data from query aggregated as total to one time series", func() {
				azData, err := loadTestFile("azuremonitor/2-azure-monitor-response-total.json")
				So(err, ShouldBeNil)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &AzureMonitorQuery{
					UrlComponents: map[string]string{
						"resourceName": "grafana",
					},
					Params: url.Values{
						"aggregation": {"Total"},
					},
				}
				err = datasource.parseResponse(res, azData, query)
				So(err, ShouldBeNil)

				So(len(res.Dataframes), ShouldEqual, 1)
				frames, err := data.UnmarshalArrowFrames(res.Dataframes)
				So(err, ShouldBeNil)
				So(len(frames), ShouldEqual, 1)
				frame := frames[0]

				So(frame.At(0, 0), ShouldEqual, time.Date(2019, 2, 9, 13, 29, 0, 0, time.UTC))
				So(frame.At(1, 0), ShouldEqual, 8.26)
			})

			Convey("when data from query aggregated as maximum to one time series", func() {
				azData, err := loadTestFile("azuremonitor/3-azure-monitor-response-maximum.json")
				So(err, ShouldBeNil)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &AzureMonitorQuery{
					UrlComponents: map[string]string{
						"resourceName": "grafana",
					},
					Params: url.Values{
						"aggregation": {"Maximum"},
					},
				}
				err = datasource.parseResponse(res, azData, query)
				So(err, ShouldBeNil)

				So(len(res.Dataframes), ShouldEqual, 1)
				frames, err := data.UnmarshalArrowFrames(res.Dataframes)
				So(err, ShouldBeNil)
				So(len(frames), ShouldEqual, 1)
				frame := frames[0]

				So(frame.At(0, 0), ShouldEqual, time.Date(2019, 2, 9, 14, 26, 0, 0, time.UTC))
				So(frame.At(1, 0), ShouldEqual, 3.07)
			})

			Convey("when data from query aggregated as minimum to one time series", func() {
				azData, err := loadTestFile("azuremonitor/4-azure-monitor-response-minimum.json")
				So(err, ShouldBeNil)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &AzureMonitorQuery{
					UrlComponents: map[string]string{
						"resourceName": "grafana",
					},
					Params: url.Values{
						"aggregation": {"Minimum"},
					},
				}
				err = datasource.parseResponse(res, azData, query)
				So(err, ShouldBeNil)

				So(len(res.Dataframes), ShouldEqual, 1)
				frames, err := data.UnmarshalArrowFrames(res.Dataframes)
				So(err, ShouldBeNil)
				So(len(frames), ShouldEqual, 1)
				frame := frames[0]

				So(frame.At(0, 0), ShouldEqual, time.Date(2019, 2, 9, 14, 43, 0, 0, time.UTC))
				So(frame.At(1, 0), ShouldEqual, 1.51)
			})

			Convey("when data from query aggregated as Count to one time series", func() {
				azData, err := loadTestFile("azuremonitor/5-azure-monitor-response-count.json")
				So(err, ShouldBeNil)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &AzureMonitorQuery{
					UrlComponents: map[string]string{
						"resourceName": "grafana",
					},
					Params: url.Values{
						"aggregation": {"Count"},
					},
				}
				err = datasource.parseResponse(res, azData, query)
				So(err, ShouldBeNil)

				So(len(res.Dataframes), ShouldEqual, 1)
				frames, err := data.UnmarshalArrowFrames(res.Dataframes)
				So(err, ShouldBeNil)
				So(len(frames), ShouldEqual, 1)
				frame := frames[0]

				So(frame.At(0, 0), ShouldEqual, time.Date(2019, 2, 9, 14, 44, 0, 0, time.UTC))
				So(frame.At(1, 0), ShouldEqual, 4)
			})

			Convey("when data from query aggregated as total and has dimension filter", func() {
				azData, err := loadTestFile("azuremonitor/6-azure-monitor-response-multi-dimension.json")
				So(err, ShouldBeNil)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &AzureMonitorQuery{
					UrlComponents: map[string]string{
						"resourceName": "grafana",
					},
					Params: url.Values{
						"aggregation": {"Average"},
					},
				}
				err = datasource.parseResponse(res, azData, query)
				So(err, ShouldBeNil)
				So(len(res.Dataframes), ShouldEqual, 3)

				frames, err := data.UnmarshalArrowFrames(res.Dataframes)

				So(frames[0].Fields[1].Name, ShouldEqual, "grafana{blobtype=PageBlob}.Blob Count")
				So(frames[0].At(1, 0), ShouldEqual, 3)

				So(frames[1].Fields[1].Name, ShouldEqual, "grafana{blobtype=BlockBlob}.Blob Count")
				So(frames[1].At(1, 0), ShouldEqual, 1)

				So(frames[2].Fields[1].Name, ShouldEqual, "grafana{blobtype=Azure Data Lake Storage}.Blob Count")
				So(frames[2].At(1, 0), ShouldEqual, 0)
			})

			Convey("when data from query has alias patterns", func() {
				azData, err := loadTestFile("azuremonitor/2-azure-monitor-response-total.json")
				So(err, ShouldBeNil)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &AzureMonitorQuery{
					Alias: "custom {{resourcegroup}} {{namespace}} {{resourceName}} {{metric}}",
					UrlComponents: map[string]string{
						"resourceName": "grafana",
					},
					Params: url.Values{
						"aggregation": {"Total"},
					},
				}
				err = datasource.parseResponse(res, azData, query)
				So(err, ShouldBeNil)

				So(len(res.Dataframes), ShouldEqual, 1)
				frames, err := data.UnmarshalArrowFrames(res.Dataframes)
				So(err, ShouldBeNil)

				So(frames[0].Fields[1].Name, ShouldEqual, "custom grafanastaging Microsoft.Compute/virtualMachines grafana Percentage CPU")
			})

			Convey("when data has dimension filters and alias patterns", func() {
				azData, err := loadTestFile("azuremonitor/6-azure-monitor-response-multi-dimension.json")
				So(err, ShouldBeNil)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &AzureMonitorQuery{
					Alias: "{{dimensionname}}={{DimensionValue}}",
					UrlComponents: map[string]string{
						"resourceName": "grafana",
					},
					Params: url.Values{
						"aggregation": {"Average"},
					},
				}
				err = datasource.parseResponse(res, azData, query)
				So(err, ShouldBeNil)

				So(len(res.Dataframes), ShouldEqual, 3)
				frames, err := data.UnmarshalArrowFrames(res.Dataframes)
				So(err, ShouldBeNil)

				So(frames[0].Fields[1].Name, ShouldEqual, "blobtype=PageBlob")
				So(frames[1].Fields[1].Name, ShouldEqual, "blobtype=BlockBlob")
				So(frames[2].Fields[1].Name, ShouldEqual, "blobtype=Azure Data Lake Storage")
			})
		})

		Convey("Find closest allowed interval for auto time grain", func() {
			intervals := map[string]int64{
				"3m":  180000,
				"5m":  300000,
				"10m": 600000,
				"15m": 900000,
				"1d":  86400000,
				"2d":  172800000,
			}

			closest := findClosestAllowedIntervalMS(intervals["3m"], []int64{})
			So(closest, ShouldEqual, intervals["5m"])

			closest = findClosestAllowedIntervalMS(intervals["10m"], []int64{})
			So(closest, ShouldEqual, intervals["15m"])

			closest = findClosestAllowedIntervalMS(intervals["2d"], []int64{})
			So(closest, ShouldEqual, intervals["1d"])

			closest = findClosestAllowedIntervalMS(intervals["3m"], []int64{intervals["1d"]})
			So(closest, ShouldEqual, intervals["1d"])
		})
	})
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
