package azuremonitor

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"

	. "github.com/smartystreets/goconvey/convey"
)

func TestAzureMonitor(t *testing.T) {
	Convey("AzureMonitor", t, func() {
		executor := &AzureMonitorExecutor{}

		Convey("Parse queries from frontend and build AzureMonitor API queries", func() {
			fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
			tsdbQuery := &tsdb.TsdbQuery{
				TimeRange: &tsdb.TimeRange{
					From: fmt.Sprintf("%v", fromStart.Unix()*1000),
					To:   fmt.Sprintf("%v", fromStart.Add(34*time.Minute).Unix()*1000),
				},
				Queries: []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"azureMonitor": map[string]interface{}{
								"timeGrain":        "PT1M",
								"aggregation":      "Average",
								"resourceGroup":    "grafanastaging",
								"resourceName":     "grafana",
								"metricDefinition": "Microsoft.Compute/virtualMachines",
								"metricName":       "Percentage CPU",
								"alias":            "testalias",
								"queryType":        "Azure Monitor",
							},
						}),
						RefId: "A",
					},
				},
			}
			Convey("and is a normal query", func() {
				queries, err := executor.buildQueries(tsdbQuery)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 1)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].URL, ShouldEqual, "resourceGroups/grafanastaging/providers/Microsoft.Compute/virtualMachines/grafana/providers/microsoft.insights/metrics")
				So(queries[0].Target, ShouldEqual, "aggregation=Average&api-version=2018-01-01&interval=PT1M&metricnames=Percentage+CPU&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z")
				So(len(queries[0].Params), ShouldEqual, 5)
				So(queries[0].Params["timespan"][0], ShouldEqual, "2018-03-15T13:00:00Z/2018-03-15T13:34:00Z")
				So(queries[0].Params["api-version"][0], ShouldEqual, "2018-01-01")
				So(queries[0].Params["aggregation"][0], ShouldEqual, "Average")
				So(queries[0].Params["metricnames"][0], ShouldEqual, "Percentage CPU")
				So(queries[0].Params["interval"][0], ShouldEqual, "PT1M")
				So(queries[0].Alias, ShouldEqual, "testalias")
			})
		})

		Convey("Parse AzureMonitor API response in the time series format", func() {
			Convey("when data from query aggregated to one time series", func() {
				data, err := loadTestFile("./test-data/1-azure-monitor-response.json")
				So(err, ShouldBeNil)
				So(data.Interval, ShouldEqual, "PT1M")

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &AzureMonitorQuery{
					UrlComponents: map[string]string{
						"resourceName": "grafana",
					},
				}
				err = executor.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				So(len(res.Series), ShouldEqual, 1)
				So(res.Series[0].Name, ShouldEqual, "grafana.Percentage CPU")
				So(len(res.Series[0].Points), ShouldEqual, 5)
			})
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
