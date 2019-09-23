package azuremonitor

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"

	. "github.com/smartystreets/goconvey/convey"
)

func TestAzureMonitorDatasource(t *testing.T) {
	Convey("AzureMonitorDatasource", t, func() {
		datasource := &AzureMonitorDatasource{}

		Convey("Parse single resource queries from frontend and build AzureMonitor API queries", func() {
			fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
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
							"azureMonitor": map[string]interface{}{
								"queryMode": "singleResource",
								"data": map[string]interface{}{
									"singleResource": map[string]interface{}{
										"timeGrain":        "PT1M",
										"aggregation":      "Average",
										"resourceGroup":    "grafanastaging",
										"resourceName":     "grafana",
										"metricDefinition": "Microsoft.Compute/virtualMachines",
										"metricNamespace":  "Microsoft.Compute-virtualMachines",
										"metricName":       "Percentage CPU",
										"alias":            "testalias",
										"queryType":        "Azure Monitor",
									},
								},
							},
						}),
						RefId: "A",
					},
				},
			}
			Convey("and is a normal query", func() {
				queries, err := datasource.buildQueries(tsdbQuery.Queries, tsdbQuery.TimeRange)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 1)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].URL, ShouldEqual, "12345678-aaaa-bbbb-cccc-123456789abc/resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics")
				So(queries[0].Target, ShouldEqual, "aggregation=Average&api-version=2018-01-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute-virtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z")
				So(len(queries[0].Params), ShouldEqual, 6)
				So(queries[0].Params["timespan"][0], ShouldEqual, "2018-03-15T13:00:00Z/2018-03-15T13:34:00Z")
				So(queries[0].Params["api-version"][0], ShouldEqual, "2018-01-01")
				So(queries[0].Params["aggregation"][0], ShouldEqual, "Average")
				So(queries[0].Params["metricnames"][0], ShouldEqual, "Percentage CPU")
				So(queries[0].Params["interval"][0], ShouldEqual, "PT1M")
				So(queries[0].Alias, ShouldEqual, "testalias")
			})

			Convey("and has a time grain set to auto", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"azureMonitor": map[string]interface{}{
						"timeGrain":        "auto",
						"aggregation":      "Average",
						"resourceGroup":    "grafanastaging",
						"resourceName":     "grafana",
						"metricDefinition": "Microsoft.Compute/virtualMachines",
						"metricNamespace":  "Microsoft.Compute-virtualMachines",
						"metricName":       "Percentage CPU",
						"alias":            "testalias",
						"queryType":        "Azure Monitor",
					},
				})
				tsdbQuery.Queries[0].IntervalMs = 400000

				queries, err := datasource.buildQueries(tsdbQuery.Queries, tsdbQuery.TimeRange)
				So(err, ShouldBeNil)

				So(queries[0].Params["interval"][0], ShouldEqual, "PT15M")
			})

			Convey("and has a time grain set to auto and the metric has a limited list of allowed time grains", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"azureMonitor": map[string]interface{}{
						"timeGrain":           "auto",
						"aggregation":         "Average",
						"resourceGroup":       "grafanastaging",
						"resourceName":        "grafana",
						"metricDefinition":    "Microsoft.Compute/virtualMachines",
						"metricNamespace":     "Microsoft.Compute-virtualMachines",
						"metricName":          "Percentage CPU",
						"alias":               "testalias",
						"queryType":           "Azure Monitor",
						"allowedTimeGrainsMs": []interface{}{"auto", json.Number("60000"), json.Number("300000")},
					},
				})
				tsdbQuery.Queries[0].IntervalMs = 400000

				queries, err := datasource.buildQueries(tsdbQuery.Queries, tsdbQuery.TimeRange)
				So(err, ShouldBeNil)

				So(queries[0].Params["interval"][0], ShouldEqual, "PT5M")
			})

			Convey("and testing dimension filter for testing backward compatibility", func() {
				Convey("and dimension filter is set", func() {
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"azureMonitor": map[string]interface{}{
							"timeGrain":        "PT1M",
							"aggregation":      "Average",
							"resourceGroup":    "grafanastaging",
							"resourceName":     "grafana",
							"metricDefinition": "Microsoft.Compute/virtualMachines",
							"metricNamespace":  "Microsoft.Compute-virtualMachines",
							"metricName":       "Percentage CPU",
							"alias":            "testalias",
							"queryType":        "Azure Monitor",
							"dimension":        "blob",
							"dimensionFilter":  "*",
						},
					})

					queries, err := datasource.buildQueries(tsdbQuery.Queries, tsdbQuery.TimeRange)
					So(err, ShouldBeNil)

					So(queries[0].Target, ShouldEqual, "%24filter=blob+eq+%27%2A%27+and+&aggregation=Average&api-version=2018-01-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute-virtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z")

				})

				Convey("and has a dimension filter set to None", func() {
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"azureMonitor": map[string]interface{}{
							"timeGrain":        "PT1M",
							"aggregation":      "Average",
							"resourceGroup":    "grafanastaging",
							"resourceName":     "grafana",
							"metricDefinition": "Microsoft.Compute/virtualMachines",
							"metricNamespace":  "Microsoft.Compute-virtualMachines",
							"metricName":       "Percentage CPU",
							"alias":            "testalias",
							"queryType":        "Azure Monitor",
							"dimension":        "None",
							"dimensionFilter":  "*",
						},
					})

					queries, err := datasource.buildQueries(tsdbQuery.Queries, tsdbQuery.TimeRange)
					So(err, ShouldBeNil)

					So(queries[0].Target, ShouldEqual, "aggregation=Average&api-version=2018-01-01&interval=PT1M&metricnames=Percentage+CPU&metricnamespace=Microsoft.Compute-virtualMachines&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z")
				})
			})
		})

		Convey("Parse multi resources queries from frontend and build AzureMonitor API queries", func() {
			var resourceLoader ResourcesLoader = &fakeResourcesLoader{}
			ds := &AzureMonitorDatasource{resources: resourceLoader}
			fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
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
							"azureMonitor": map[string]interface{}{
								"queryMode": "crossResource",
								"data": map[string]interface{}{
									"crossResource": map[string]interface{}{
										"timeGrain":        "PT1M",
										"aggregation":      "Average",
										"resourceGroups":   []string{"grafanastaging", "grafanastaging2"},
										"resourceName":     "grafana",
										"metricDefinition": "Microsoft.Compute/virtualMachines",
										"metricNamespace":  "Microsoft.Compute-virtualMachines",
										"metricName":       "Percentage CPU",
										"alias":            "testalias",
										"queryType":        "Azure Monitor",
										"dimensionFilters": []DimensionFilter{{Dimension: "dimension", Filter: "*"}, {Dimension: "None", Filter: "*"}, {Dimension: "Test", Filter: ""}, {Dimension: "", Filter: "*"}},
									},
								},
							},
						}),
						RefId: "A",
					},
				},
			}

			Convey("and is a normal query", func() {
				queries, err := ds.buildQueries(tsdbQuery.Queries, tsdbQuery.TimeRange)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 3)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].URL, ShouldEqual, "someSubscriptionId1/resourceGroups/someResourceGroup1/providers/someResourceType1/someResourceName1/providers/microsoft.insights/metrics")
				So(queries[0].Target, ShouldEqual, "%24filter=dimension+eq+%27%2A%27+and+&aggregation=Average&api-version=2018-01-01&interval=PT1M&metricnames=Percentage+CPU&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z")
				So(len(queries[0].Params), ShouldEqual, 6)
				So(queries[0].Params["timespan"][0], ShouldEqual, "2018-03-15T13:00:00Z/2018-03-15T13:34:00Z")
				So(queries[0].Params["api-version"][0], ShouldEqual, "2018-01-01")
				So(queries[0].Params["aggregation"][0], ShouldEqual, "Average")
				So(queries[0].Params["metricnames"][0], ShouldEqual, "Percentage CPU")
				So(queries[0].Params["interval"][0], ShouldEqual, "PT1M")
				So(queries[0].Alias, ShouldEqual, "testalias")
			})

			Convey("and testing dimension filter with multiple filters", func() {
				queries, err := ds.buildQueries(tsdbQuery.Queries, tsdbQuery.TimeRange)
				So(err, ShouldBeNil)

				So(queries[0].Target, ShouldEqual, "%24filter=dimension+eq+%27%2A%27+and+&aggregation=Average&api-version=2018-01-01&interval=PT1M&metricnames=Percentage+CPU&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z")
			})
		})

		Convey("Parse AzureMonitor API response in the time series format", func() {
			Convey("when data from query aggregated as average to one time series", func() {
				data, err := loadTestFile("./test-data/1-azure-monitor-response-avg.json")
				So(err, ShouldBeNil)
				So(data.Interval, ShouldEqual, "PT1M")

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &AzureMonitorQuery{
					UrlComponents: map[string]string{
						"resourceName": "grafana",
					},
					Params: url.Values{
						"aggregation": {"Average"},
					},
				}
				err = datasource.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				So(len(res.Series), ShouldEqual, 1)
				So(res.Series[0].Name, ShouldEqual, "grafana.Percentage CPU")
				So(len(res.Series[0].Points), ShouldEqual, 5)

				So(res.Series[0].Points[0][0].Float64, ShouldEqual, 2.0875)
				So(res.Series[0].Points[0][1].Float64, ShouldEqual, int64(1549620780000))

				So(res.Series[0].Points[1][0].Float64, ShouldEqual, 2.1525)
				So(res.Series[0].Points[1][1].Float64, ShouldEqual, int64(1549620840000))

				So(res.Series[0].Points[2][0].Float64, ShouldEqual, 2.155)
				So(res.Series[0].Points[2][1].Float64, ShouldEqual, int64(1549620900000))

				So(res.Series[0].Points[3][0].Float64, ShouldEqual, 3.6925)
				So(res.Series[0].Points[3][1].Float64, ShouldEqual, int64(1549620960000))

				So(res.Series[0].Points[4][0].Float64, ShouldEqual, 2.44)
				So(res.Series[0].Points[4][1].Float64, ShouldEqual, int64(1549621020000))
			})

			Convey("when data from query aggregated as total to one time series", func() {
				data, err := loadTestFile("./test-data/2-azure-monitor-response-total.json")
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
				err = datasource.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				So(res.Series[0].Points[0][0].Float64, ShouldEqual, 8.26)
				So(res.Series[0].Points[0][1].Float64, ShouldEqual, int64(1549718940000))
			})

			Convey("when data from query aggregated as maximum to one time series", func() {
				data, err := loadTestFile("./test-data/3-azure-monitor-response-maximum.json")
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
				err = datasource.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				So(res.Series[0].Points[0][0].Float64, ShouldEqual, 3.07)
				So(res.Series[0].Points[0][1].Float64, ShouldEqual, int64(1549722360000))
			})

			Convey("when data from query aggregated as minimum to one time series", func() {
				data, err := loadTestFile("./test-data/4-azure-monitor-response-minimum.json")
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
				err = datasource.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				So(res.Series[0].Points[0][0].Float64, ShouldEqual, 1.51)
				So(res.Series[0].Points[0][1].Float64, ShouldEqual, int64(1549723380000))
			})

			Convey("when data from query aggregated as Count to one time series", func() {
				data, err := loadTestFile("./test-data/5-azure-monitor-response-count.json")
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
				err = datasource.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				So(res.Series[0].Points[0][0].Float64, ShouldEqual, 4)
				So(res.Series[0].Points[0][1].Float64, ShouldEqual, int64(1549723440000))
			})

			Convey("when data from query aggregated as total and has dimension filter", func() {
				data, err := loadTestFile("./test-data/6-azure-monitor-response-multi-dimension.json")
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
				err = datasource.parseResponse(res, data, query)
				So(err, ShouldBeNil)
				So(len(res.Series), ShouldEqual, 3)

				So(res.Series[0].Name, ShouldEqual, "grafana{blobtype=PageBlob}.Blob Count")
				So(res.Series[0].Points[0][0].Float64, ShouldEqual, 3)

				So(res.Series[1].Name, ShouldEqual, "grafana{blobtype=BlockBlob}.Blob Count")
				So(res.Series[1].Points[0][0].Float64, ShouldEqual, 1)

				So(res.Series[2].Name, ShouldEqual, "grafana{blobtype=Azure Data Lake Storage}.Blob Count")
				So(res.Series[2].Points[0][0].Float64, ShouldEqual, 0)
			})

			Convey("when data from query has alias patterns", func() {
				data, err := loadTestFile("./test-data/2-azure-monitor-response-total.json")
				So(err, ShouldBeNil)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &AzureMonitorQuery{
					Alias: "custom {{resourcegroup}} {{namespace}} {{resourceName}} {{metric}} {{subscription}}",
					UrlComponents: map[string]string{
						"resourceName": "grafana",
						"subscription": "12345678-aaaa-bbbb-cccc-123456789abc",
					},
					Params: url.Values{
						"aggregation": {"Total"},
					},
				}
				err = datasource.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				So(res.Series[0].Name, ShouldEqual, "custom grafanastaging Microsoft.Compute/virtualMachines grafana Percentage CPU 12345678-aaaa-bbbb-cccc-123456789abc")
			})

			Convey("when data has dimension filters and alias patterns", func() {
				data, err := loadTestFile("./test-data/6-azure-monitor-response-multi-dimension.json")
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
				err = datasource.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				So(res.Series[0].Name, ShouldEqual, "blobtype=PageBlob")
				So(res.Series[1].Name, ShouldEqual, "blobtype=BlockBlob")
				So(res.Series[2].Name, ShouldEqual, "blobtype=Azure Data Lake Storage")
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

			closest := datasource.findClosestAllowedIntervalMS(intervals["3m"], []int64{})
			So(closest, ShouldEqual, intervals["5m"])

			closest = datasource.findClosestAllowedIntervalMS(intervals["10m"], []int64{})
			So(closest, ShouldEqual, intervals["15m"])

			closest = datasource.findClosestAllowedIntervalMS(intervals["2d"], []int64{})
			So(closest, ShouldEqual, intervals["1d"])

			closest = datasource.findClosestAllowedIntervalMS(intervals["3m"], []int64{intervals["1d"]})
			So(closest, ShouldEqual, intervals["1d"])
		})
	})
}

func loadTestFile(path string) (AzureMonitorResponse, error) {
	var data AzureMonitorResponse

	jsonBody, err := ioutil.ReadFile(path)
	if err != nil {
		return data, err
	}
	err = json.Unmarshal(jsonBody, &data)
	return data, err
}

type fakeResourcesLoader struct {
}

func (_ *fakeResourcesLoader) Get(azureMonitorData *AzureMonitorData, subscriptions []interface{}, createRequest func(context.Context, *models.DataSource) (*http.Request, error)) ([]resource, error) {

	return []resource{{
		ID:             "/subscriptions/someSubscriptionId1/resourceGroups/someResourceGroup1/providers/adassd",
		Name:           "someResourceName1",
		Type:           "someResourceType1",
		Location:       "someResourceLocation1",
		SubscriptionID: "someSubscriptionId1",
	}, {
		ID:             "/subscriptions/someSubscriptionId2/resourceGroups/someResourceGroup2/providers/adassd",
		Name:           "someResourceName2",
		Type:           "someResourceType2",
		Location:       "someResourceLocation2",
		SubscriptionID: "someSubscriptionId2",
	}, {
		ID:             "/subscriptions/someSubscriptionId1/resourceGroups/someResourceGroup3/providers/adassd",
		Name:           "someResourceName2",
		Type:           "someResourceType2",
		Location:       "someResourceLocation3",
		SubscriptionID: "someSubscriptionId1",
	}}, nil
}
