package stackdriver

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"

	. "github.com/smartystreets/goconvey/convey"
)

func TestStackdriver(t *testing.T) {
	Convey("Stackdriver", t, func() {
		executor := &StackdriverExecutor{}

		Convey("Parse queries from frontend and build Stackdriver API queries", func() {
			fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
			tsdbQuery := &tsdb.TsdbQuery{
				TimeRange: &tsdb.TimeRange{
					From: fmt.Sprintf("%v", fromStart.Unix()*1000),
					To:   fmt.Sprintf("%v", fromStart.Add(34*time.Minute).Unix()*1000),
				},
				Queries: []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"metricType": "a/metric/type",
							"view":       "FULL",
							"aliasBy":    "testalias",
							"type":       "timeSeriesQuery",
						}),
						RefId: "A",
					},
				},
			}

			Convey("and query has no aggregation set", func() {
				queries, err := executor.buildQueries(tsdbQuery)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 1)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].Target, ShouldEqual, "aggregation.alignmentPeriod=%2B60s&aggregation.crossSeriesReducer=REDUCE_NONE&aggregation.perSeriesAligner=ALIGN_MEAN&filter=metric.type%3D%22a%2Fmetric%2Ftype%22&interval.endTime=2018-03-15T13%3A34%3A00Z&interval.startTime=2018-03-15T13%3A00%3A00Z&view=FULL")
				So(len(queries[0].Params), ShouldEqual, 7)
				So(queries[0].Params["interval.startTime"][0], ShouldEqual, "2018-03-15T13:00:00Z")
				So(queries[0].Params["interval.endTime"][0], ShouldEqual, "2018-03-15T13:34:00Z")
				So(queries[0].Params["aggregation.perSeriesAligner"][0], ShouldEqual, "ALIGN_MEAN")
				So(queries[0].Params["filter"][0], ShouldEqual, "metric.type=\"a/metric/type\"")
				So(queries[0].Params["view"][0], ShouldEqual, "FULL")
				So(queries[0].AliasBy, ShouldEqual, "testalias")
			})

			Convey("and query has filters", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"metricType": "a/metric/type",
					"filters":    []interface{}{"key", "=", "value", "AND", "key2", "=", "value2"},
				})

				queries, err := executor.buildQueries(tsdbQuery)
				So(err, ShouldBeNil)
				So(len(queries), ShouldEqual, 1)
				So(queries[0].Params["filter"][0], ShouldEqual, `metric.type="a/metric/type" key="value" key2="value2"`)
			})

			Convey("and alignmentPeriod is set to grafana-auto", func() {
				Convey("and IntervalMs is larger than 60000", func() {
					tsdbQuery.Queries[0].IntervalMs = 1000000
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"alignmentPeriod": "grafana-auto",
						"filters":         []interface{}{"key", "=", "value", "AND", "key2", "=", "value2"},
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+1000s`)
				})
				Convey("and IntervalMs is less than 60000", func() {
					tsdbQuery.Queries[0].IntervalMs = 30000
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"alignmentPeriod": "grafana-auto",
						"filters":         []interface{}{"key", "=", "value", "AND", "key2", "=", "value2"},
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+60s`)
				})
			})

			Convey("and alignmentPeriod is set to stackdriver-auto", func() {
				Convey("and range is two hours", func() {
					tsdbQuery.TimeRange.From = "1538033322461"
					tsdbQuery.TimeRange.To = "1538040522461"
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"target":          "target",
						"alignmentPeriod": "stackdriver-auto",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+60s`)
				})

				Convey("and range is 22 hours", func() {
					tsdbQuery.TimeRange.From = "1538034524922"
					tsdbQuery.TimeRange.To = "1538113724922"
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"target":          "target",
						"alignmentPeriod": "stackdriver-auto",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+60s`)
				})

				Convey("and range is 23 hours", func() {
					tsdbQuery.TimeRange.From = "1538034567985"
					tsdbQuery.TimeRange.To = "1538117367985"
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"target":          "target",
						"alignmentPeriod": "stackdriver-auto",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+300s`)
				})

				Convey("and range is 7 days", func() {
					tsdbQuery.TimeRange.From = "1538036324073"
					tsdbQuery.TimeRange.To = "1538641124073"
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"target":          "target",
						"alignmentPeriod": "stackdriver-auto",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+3600s`)
				})
			})

			Convey("and alignmentPeriod is set in frontend", func() {
				Convey("and alignment period is too big", func() {
					tsdbQuery.Queries[0].IntervalMs = 1000
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"alignmentPeriod": "+360000s",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+3600s`)
				})

				Convey("and alignment period is within accepted range", func() {
					tsdbQuery.Queries[0].IntervalMs = 1000
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"alignmentPeriod": "+600s",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+600s`)
				})
			})

			Convey("and query has aggregation mean set", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"metricType":         "a/metric/type",
					"primaryAggregation": "REDUCE_MEAN",
					"view":               "FULL",
				})

				queries, err := executor.buildQueries(tsdbQuery)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 1)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].Target, ShouldEqual, "aggregation.alignmentPeriod=%2B60s&aggregation.crossSeriesReducer=REDUCE_MEAN&aggregation.perSeriesAligner=ALIGN_MEAN&filter=metric.type%3D%22a%2Fmetric%2Ftype%22&interval.endTime=2018-03-15T13%3A34%3A00Z&interval.startTime=2018-03-15T13%3A00%3A00Z&view=FULL")
				So(len(queries[0].Params), ShouldEqual, 7)
				So(queries[0].Params["interval.startTime"][0], ShouldEqual, "2018-03-15T13:00:00Z")
				So(queries[0].Params["interval.endTime"][0], ShouldEqual, "2018-03-15T13:34:00Z")
				So(queries[0].Params["aggregation.crossSeriesReducer"][0], ShouldEqual, "REDUCE_MEAN")
				So(queries[0].Params["aggregation.perSeriesAligner"][0], ShouldEqual, "ALIGN_MEAN")
				So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, "+60s")
				So(queries[0].Params["filter"][0], ShouldEqual, "metric.type=\"a/metric/type\"")
				So(queries[0].Params["view"][0], ShouldEqual, "FULL")
			})

			Convey("and query has group bys", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"metricType":         "a/metric/type",
					"primaryAggregation": "REDUCE_NONE",
					"groupBys":           []interface{}{"metric.label.group1", "metric.label.group2"},
					"view":               "FULL",
				})

				queries, err := executor.buildQueries(tsdbQuery)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 1)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].Target, ShouldEqual, "aggregation.alignmentPeriod=%2B60s&aggregation.crossSeriesReducer=REDUCE_NONE&aggregation.groupByFields=metric.label.group1&aggregation.groupByFields=metric.label.group2&aggregation.perSeriesAligner=ALIGN_MEAN&filter=metric.type%3D%22a%2Fmetric%2Ftype%22&interval.endTime=2018-03-15T13%3A34%3A00Z&interval.startTime=2018-03-15T13%3A00%3A00Z&view=FULL")
				So(len(queries[0].Params), ShouldEqual, 8)
				So(queries[0].Params["interval.startTime"][0], ShouldEqual, "2018-03-15T13:00:00Z")
				So(queries[0].Params["interval.endTime"][0], ShouldEqual, "2018-03-15T13:34:00Z")
				So(queries[0].Params["aggregation.perSeriesAligner"][0], ShouldEqual, "ALIGN_MEAN")
				So(queries[0].Params["aggregation.groupByFields"][0], ShouldEqual, "metric.label.group1")
				So(queries[0].Params["aggregation.groupByFields"][1], ShouldEqual, "metric.label.group2")
				So(queries[0].Params["filter"][0], ShouldEqual, "metric.type=\"a/metric/type\"")
				So(queries[0].Params["view"][0], ShouldEqual, "FULL")
			})

		})

		Convey("Parse stackdriver response in the time series format", func() {
			Convey("when data from query aggregated to one time series", func() {
				data, err := loadTestFile("./test-data/1-series-response-agg-one-metric.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 1)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &StackdriverQuery{}
				err = executor.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				So(len(res.Series), ShouldEqual, 1)
				So(res.Series[0].Name, ShouldEqual, "serviceruntime.googleapis.com/api/request_count")
				So(len(res.Series[0].Points), ShouldEqual, 3)

				Convey("timestamps should be in ascending order", func() {
					So(res.Series[0].Points[0][0].Float64, ShouldEqual, 0.05)
					So(res.Series[0].Points[0][1].Float64, ShouldEqual, 1536670020000)

					So(res.Series[0].Points[1][0].Float64, ShouldEqual, 1.05)
					So(res.Series[0].Points[1][1].Float64, ShouldEqual, 1536670080000)

					So(res.Series[0].Points[2][0].Float64, ShouldEqual, 1.0666666666667)
					So(res.Series[0].Points[2][1].Float64, ShouldEqual, 1536670260000)
				})
			})

			Convey("when data from query with no aggregation", func() {
				data, err := loadTestFile("./test-data/2-series-response-no-agg.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 3)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &StackdriverQuery{}
				err = executor.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				Convey("Should add labels to metric name", func() {
					So(len(res.Series), ShouldEqual, 3)
					So(res.Series[0].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-asia-east-1")
					So(res.Series[1].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-europe-west-1")
					So(res.Series[2].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-us-east-1")
				})

				Convey("Should parse to time series", func() {
					So(len(res.Series[0].Points), ShouldEqual, 3)
					So(res.Series[0].Points[0][0].Float64, ShouldEqual, 9.8566497180145)
					So(res.Series[0].Points[1][0].Float64, ShouldEqual, 9.7323568146676)
					So(res.Series[0].Points[2][0].Float64, ShouldEqual, 9.7730520330369)
				})

				Convey("Should add meta for labels to the response", func() {
					metricLabels := res.Meta.Get("metricLabels").Interface().(map[string][]string)
					So(metricLabels, ShouldNotBeNil)
					So(len(metricLabels["instance_name"]), ShouldEqual, 3)
					So(metricLabels["instance_name"][0], ShouldEqual, "collector-asia-east-1")
					So(metricLabels["instance_name"][1], ShouldEqual, "collector-europe-west-1")
					So(metricLabels["instance_name"][2], ShouldEqual, "collector-us-east-1")

					resourceLabels := res.Meta.Get("resourceLabels").Interface().(map[string][]string)
					So(resourceLabels, ShouldNotBeNil)
					So(len(resourceLabels["zone"]), ShouldEqual, 3)
					So(resourceLabels["zone"][0], ShouldEqual, "asia-east1-a")
					So(resourceLabels["zone"][1], ShouldEqual, "europe-west1-b")
					So(resourceLabels["zone"][2], ShouldEqual, "us-east1-b")

					So(len(resourceLabels["project_id"]), ShouldEqual, 1)
					So(resourceLabels["project_id"][0], ShouldEqual, "grafana-prod")
				})
			})

			Convey("when data from query with no aggregation and group bys", func() {
				data, err := loadTestFile("./test-data/2-series-response-no-agg.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 3)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &StackdriverQuery{GroupBys: []string{"metric.label.instance_name", "resource.label.zone"}}
				err = executor.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				Convey("Should add instance name and zone labels to metric name", func() {
					So(len(res.Series), ShouldEqual, 3)
					So(res.Series[0].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-asia-east-1 asia-east1-a")
					So(res.Series[1].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-europe-west-1 europe-west1-b")
					So(res.Series[2].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-us-east-1 us-east1-b")
				})
			})

			Convey("when data from query with no aggregation and alias by", func() {
				data, err := loadTestFile("./test-data/2-series-response-no-agg.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 3)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}

				Convey("and the alias pattern is for metric type, a metric label and a resource label", func() {

					query := &StackdriverQuery{AliasBy: "{{metric.type}} - {{metric.label.instance_name}} - {{resource.label.zone}}", GroupBys: []string{"metric.label.instance_name", "resource.label.zone"}}
					err = executor.parseResponse(res, data, query)
					So(err, ShouldBeNil)

					Convey("Should use alias by formatting and only show instance name", func() {
						So(len(res.Series), ShouldEqual, 3)
						So(res.Series[0].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time - collector-asia-east-1 - asia-east1-a")
						So(res.Series[1].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time - collector-europe-west-1 - europe-west1-b")
						So(res.Series[2].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time - collector-us-east-1 - us-east1-b")
					})
				})

				Convey("and the alias pattern is for metric name", func() {

					query := &StackdriverQuery{AliasBy: "metric {{metric.name}} service {{metric.service}}", GroupBys: []string{"metric.label.instance_name", "resource.label.zone"}}
					err = executor.parseResponse(res, data, query)
					So(err, ShouldBeNil)

					Convey("Should use alias by formatting and only show instance name", func() {
						So(len(res.Series), ShouldEqual, 3)
						So(res.Series[0].Name, ShouldEqual, "metric instance/cpu/usage_time service compute")
						So(res.Series[1].Name, ShouldEqual, "metric instance/cpu/usage_time service compute")
						So(res.Series[2].Name, ShouldEqual, "metric instance/cpu/usage_time service compute")
					})
				})
			})

			Convey("when data from query is distribution", func() {
				data, err := loadTestFile("./test-data/3-series-response-distribution.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 1)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &StackdriverQuery{AliasBy: "{{bucket}}"}
				err = executor.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				So(len(res.Series), ShouldEqual, 11)
				for i := 0; i < 11; i++ {
					if i == 0 {
						So(res.Series[i].Name, ShouldEqual, "0")
					} else {
						So(res.Series[i].Name, ShouldEqual, strconv.FormatInt(int64(math.Pow(float64(2), float64(i-1))), 10))
					}
					So(len(res.Series[i].Points), ShouldEqual, 3)
				}

				Convey("timestamps should be in ascending order", func() {
					So(res.Series[0].Points[0][1].Float64, ShouldEqual, 1536668940000)
					So(res.Series[0].Points[1][1].Float64, ShouldEqual, 1536669000000)
					So(res.Series[0].Points[2][1].Float64, ShouldEqual, 1536669060000)
				})

				Convey("value should be correct", func() {
					So(res.Series[8].Points[0][0].Float64, ShouldEqual, 1)
					So(res.Series[9].Points[0][0].Float64, ShouldEqual, 1)
					So(res.Series[10].Points[0][0].Float64, ShouldEqual, 1)
					So(res.Series[8].Points[1][0].Float64, ShouldEqual, 0)
					So(res.Series[9].Points[1][0].Float64, ShouldEqual, 0)
					So(res.Series[10].Points[1][0].Float64, ShouldEqual, 1)
					So(res.Series[8].Points[2][0].Float64, ShouldEqual, 0)
					So(res.Series[9].Points[2][0].Float64, ShouldEqual, 1)
					So(res.Series[10].Points[2][0].Float64, ShouldEqual, 0)
				})
			})

		})

		Convey("when interpolating filter wildcards", func() {
			Convey("and wildcard is used in the beginning and the end of the word", func() {
				Convey("and theres no wildcard in the middle of the word", func() {
					value := interpolateFilterWildcards("*-central1*")
					So(value, ShouldEqual, `has_substring("-central1")`)
				})
				Convey("and there is a wildcard in the middle of the word", func() {
					value := interpolateFilterWildcards("*-cent*ral1*")
					So(value, ShouldNotStartWith, `has_substring`)
				})
			})

			Convey("and wildcard is used in the beginning of the word", func() {
				Convey("and there is not a wildcard elsewhere in the word", func() {
					value := interpolateFilterWildcards("*-central1")
					So(value, ShouldEqual, `ends_with("-central1")`)
				})
				Convey("and there is a wildcard elsewhere in the word", func() {
					value := interpolateFilterWildcards("*-cent*al1")
					So(value, ShouldNotStartWith, `ends_with`)
				})
			})

			Convey("and wildcard is used at the end of the word", func() {
				Convey("and there is not a wildcard elsewhere in the word", func() {
					value := interpolateFilterWildcards("us-central*")
					So(value, ShouldEqual, `starts_with("us-central")`)
				})
				Convey("and there is a wildcard elsewhere in the word", func() {
					value := interpolateFilterWildcards("*us-central*")
					So(value, ShouldNotStartWith, `starts_with`)
				})
			})

			Convey("and wildcard is used in the middle of the word", func() {
				Convey("and there is only one wildcard", func() {
					value := interpolateFilterWildcards("us-ce*tral1-b")
					So(value, ShouldEqual, `monitoring.regex.full_match("^us\\-ce.*tral1\\-b$")`)
				})

				Convey("and there is more than one wildcard", func() {
					value := interpolateFilterWildcards("us-ce*tra*1-b")
					So(value, ShouldEqual, `monitoring.regex.full_match("^us\\-ce.*tra.*1\\-b$")`)
				})
			})

			Convey("and wildcard is used in the middle of the word and in the beginning of the word", func() {
				value := interpolateFilterWildcards("*s-ce*tral1-b")
				So(value, ShouldEqual, `monitoring.regex.full_match("^.*s\\-ce.*tral1\\-b$")`)
			})

			Convey("and wildcard is used in the middle of the word and in the ending of the word", func() {
				value := interpolateFilterWildcards("us-ce*tral1-*")
				So(value, ShouldEqual, `monitoring.regex.full_match("^us\\-ce.*tral1\\-.*$")`)
			})

			Convey("and no wildcard is used", func() {
				value := interpolateFilterWildcards("us-central1-a}")
				So(value, ShouldEqual, `us-central1-a}`)
			})
		})

		Convey("when building filter string", func() {
			Convey("and theres no regex operator", func() {
				Convey("and there are wildcards in a filter value", func() {
					filterParts := []interface{}{"zone", "=", "*-central1*"}
					value := buildFilterString("somemetrictype", filterParts)
					So(value, ShouldEqual, `metric.type="somemetrictype" zone=has_substring("-central1")`)
				})

				Convey("and there are no wildcards in any filter value", func() {
					filterParts := []interface{}{"zone", "!=", "us-central1-a"}
					value := buildFilterString("somemetrictype", filterParts)
					So(value, ShouldEqual, `metric.type="somemetrictype" zone!="us-central1-a"`)
				})
			})

			Convey("and there is a regex operator", func() {
				filterParts := []interface{}{"zone", "=~", "us-central1-a~"}
				value := buildFilterString("somemetrictype", filterParts)
				Convey("it should remove the ~ character from the operator that belongs to the value", func() {
					So(value, ShouldNotContainSubstring, `=~`)
					So(value, ShouldContainSubstring, `zone=`)
				})

				Convey("it should insert monitoring.regex.full_match before filter value", func() {
					So(value, ShouldContainSubstring, `zone=monitoring.regex.full_match("us-central1-a~")`)
				})
			})
		})
	})
}

func loadTestFile(path string) (StackdriverResponse, error) {
	var data StackdriverResponse

	jsonBody, err := ioutil.ReadFile(path)
	if err != nil {
		return data, err
	}
	err = json.Unmarshal(jsonBody, &data)
	return data, err
}
