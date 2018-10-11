package elasticsearch

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestExecuteTimeSeriesQuery(t *testing.T) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	fromStr := fmt.Sprintf("%d", from.UnixNano()/int64(time.Millisecond))
	toStr := fmt.Sprintf("%d", to.UnixNano()/int64(time.Millisecond))

	Convey("Test execute time series query", t, func() {
		Convey("With defaults on es 2", func() {
			c := newFakeClient(2)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "2" }],
				"metrics": [{"type": "count", "id": "0" }]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]
			rangeFilter := sr.Query.Bool.Filters[0].(*es.RangeFilter)
			So(rangeFilter.Key, ShouldEqual, c.timeField)
			So(rangeFilter.Lte, ShouldEqual, toStr)
			So(rangeFilter.Gte, ShouldEqual, fromStr)
			So(rangeFilter.Format, ShouldEqual, es.DateFormatEpochMS)
			So(sr.Aggs[0].Key, ShouldEqual, "2")
			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)
			So(dateHistogramAgg.Field, ShouldEqual, "@timestamp")
			So(dateHistogramAgg.ExtendedBounds.Min, ShouldEqual, fromStr)
			So(dateHistogramAgg.ExtendedBounds.Max, ShouldEqual, toStr)
		})

		Convey("With defaults on es 5", func() {
			c := newFakeClient(5)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "2" }],
				"metrics": [{"type": "count", "id": "0" }]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]
			So(sr.Query.Bool.Filters[0].(*es.RangeFilter).Key, ShouldEqual, c.timeField)
			So(sr.Aggs[0].Key, ShouldEqual, "2")
			So(sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg).ExtendedBounds.Min, ShouldEqual, fromStr)
			So(sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg).ExtendedBounds.Max, ShouldEqual, toStr)
		})

		Convey("With multiple bucket aggs", func() {
			c := newFakeClient(5)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "terms", "field": "@host", "id": "2", "settings": { "size": "0", "order": "asc" } },
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "2")
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)
			So(termsAgg.Field, ShouldEqual, "@host")
			So(termsAgg.Size, ShouldEqual, 500)
			secondLevel := firstLevel.Aggregation.Aggs[0]
			So(secondLevel.Key, ShouldEqual, "3")
			So(secondLevel.Aggregation.Aggregation.(*es.DateHistogramAgg).Field, ShouldEqual, "@timestamp")
		})

		Convey("With select field", func() {
			c := newFakeClient(5)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "2" }
				],
				"metrics": [{"type": "avg", "field": "@value", "id": "1" }]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "2")
			So(firstLevel.Aggregation.Aggregation.(*es.DateHistogramAgg).Field, ShouldEqual, "@timestamp")
			secondLevel := firstLevel.Aggregation.Aggs[0]
			So(secondLevel.Key, ShouldEqual, "1")
			So(secondLevel.Aggregation.Type, ShouldEqual, "avg")
			So(secondLevel.Aggregation.Aggregation.(*es.MetricAggregation).Field, ShouldEqual, "@value")
		})

		Convey("With term agg and order by metric agg", func() {
			c := newFakeClient(5)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"type": "terms",
						"field": "@host",
						"id": "2",
						"settings": { "size": "5", "order": "asc", "orderBy": "5"	}
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
					{"type": "count", "id": "1" },
					{"type": "avg", "field": "@value", "id": "5" }
				]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			avgAggOrderBy := sr.Aggs[0].Aggregation.Aggs[0]
			So(avgAggOrderBy.Key, ShouldEqual, "5")
			So(avgAggOrderBy.Aggregation.Type, ShouldEqual, "avg")

			avgAgg := sr.Aggs[0].Aggregation.Aggs[1].Aggregation.Aggs[0]
			So(avgAgg.Key, ShouldEqual, "5")
			So(avgAgg.Aggregation.Type, ShouldEqual, "avg")
		})

		Convey("With metric percentiles", func() {
			c := newFakeClient(5)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
					{
						"id": "1",
						"type": "percentiles",
						"field": "@load_time",
						"settings": {
							"percents": [ "1", "2", "3", "4" ]
						}
					}
				]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			percentilesAgg := sr.Aggs[0].Aggregation.Aggs[0]
			So(percentilesAgg.Key, ShouldEqual, "1")
			So(percentilesAgg.Aggregation.Type, ShouldEqual, "percentiles")
			metricAgg := percentilesAgg.Aggregation.Aggregation.(*es.MetricAggregation)
			percents := metricAgg.Settings["percents"].([]interface{})
			So(percents, ShouldHaveLength, 4)
			So(percents[0], ShouldEqual, "1")
			So(percents[1], ShouldEqual, "2")
			So(percents[2], ShouldEqual, "3")
			So(percents[3], ShouldEqual, "4")
		})

		Convey("With filters aggs on es 2", func() {
			c := newFakeClient(2)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"id": "2",
						"type": "filters",
						"settings": {
							"filters": [ { "query": "@metric:cpu" }, { "query": "@metric:logins.count" } ]
						}
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			filtersAgg := sr.Aggs[0]
			So(filtersAgg.Key, ShouldEqual, "2")
			So(filtersAgg.Aggregation.Type, ShouldEqual, "filters")
			fAgg := filtersAgg.Aggregation.Aggregation.(*es.FiltersAggregation)
			So(fAgg.Filters["@metric:cpu"].(*es.QueryStringFilter).Query, ShouldEqual, "@metric:cpu")
			So(fAgg.Filters["@metric:logins.count"].(*es.QueryStringFilter).Query, ShouldEqual, "@metric:logins.count")

			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggs[0]
			So(dateHistogramAgg.Key, ShouldEqual, "4")
			So(dateHistogramAgg.Aggregation.Aggregation.(*es.DateHistogramAgg).Field, ShouldEqual, "@timestamp")
		})

		Convey("With filters aggs on es 5", func() {
			c := newFakeClient(5)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"id": "2",
						"type": "filters",
						"settings": {
							"filters": [ { "query": "@metric:cpu" }, { "query": "@metric:logins.count" } ]
						}
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			filtersAgg := sr.Aggs[0]
			So(filtersAgg.Key, ShouldEqual, "2")
			So(filtersAgg.Aggregation.Type, ShouldEqual, "filters")
			fAgg := filtersAgg.Aggregation.Aggregation.(*es.FiltersAggregation)
			So(fAgg.Filters["@metric:cpu"].(*es.QueryStringFilter).Query, ShouldEqual, "@metric:cpu")
			So(fAgg.Filters["@metric:logins.count"].(*es.QueryStringFilter).Query, ShouldEqual, "@metric:logins.count")

			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggs[0]
			So(dateHistogramAgg.Key, ShouldEqual, "4")
			So(dateHistogramAgg.Aggregation.Aggregation.(*es.DateHistogramAgg).Field, ShouldEqual, "@timestamp")
		})

		Convey("With raw document metric", func() {
			c := newFakeClient(5)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_document", "settings": {}	}]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			So(sr.Size, ShouldEqual, 500)
		})

		Convey("With raw document metric size set", func() {
			c := newFakeClient(5)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_document", "settings": { "size": 1337 }	}]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			So(sr.Size, ShouldEqual, 1337)
		})

		Convey("With date histogram agg", func() {
			c := newFakeClient(5)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"id": "2",
						"type": "date_histogram",
						"field": "@timestamp",
						"settings": { "interval": "auto", "min_doc_count": 2 }
					}
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "2")
			So(firstLevel.Aggregation.Type, ShouldEqual, "date_histogram")
			hAgg := firstLevel.Aggregation.Aggregation.(*es.DateHistogramAgg)
			So(hAgg.Field, ShouldEqual, "@timestamp")
			So(hAgg.Interval, ShouldEqual, "$__interval")
			So(hAgg.MinDocCount, ShouldEqual, 2)
		})

		Convey("With histogram agg", func() {
			c := newFakeClient(5)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"id": "3",
						"type": "histogram",
						"field": "bytes",
						"settings": { "interval": 10, "min_doc_count": 2, "missing": 5 }
					}
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "3")
			So(firstLevel.Aggregation.Type, ShouldEqual, "histogram")
			hAgg := firstLevel.Aggregation.Aggregation.(*es.HistogramAgg)
			So(hAgg.Field, ShouldEqual, "bytes")
			So(hAgg.Interval, ShouldEqual, 10)
			So(hAgg.MinDocCount, ShouldEqual, 2)
			So(*hAgg.Missing, ShouldEqual, 5)
		})

		Convey("With geo hash grid agg", func() {
			c := newFakeClient(5)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"id": "3",
						"type": "geohash_grid",
						"field": "@location",
						"settings": { "precision": 3 }
					}
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "3")
			So(firstLevel.Aggregation.Type, ShouldEqual, "geohash_grid")
			ghGridAgg := firstLevel.Aggregation.Aggregation.(*es.GeoHashGridAggregation)
			So(ghGridAgg.Field, ShouldEqual, "@location")
			So(ghGridAgg.Precision, ShouldEqual, 3)
		})

		Convey("With moving average", func() {
			c := newFakeClient(5)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "moving_avg",
						"field": "3",
						"pipelineAgg": "3"
					}
				]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "4")
			So(firstLevel.Aggregation.Type, ShouldEqual, "date_histogram")
			So(firstLevel.Aggregation.Aggs, ShouldHaveLength, 2)

			sumAgg := firstLevel.Aggregation.Aggs[0]
			So(sumAgg.Key, ShouldEqual, "3")
			So(sumAgg.Aggregation.Type, ShouldEqual, "sum")
			mAgg := sumAgg.Aggregation.Aggregation.(*es.MetricAggregation)
			So(mAgg.Field, ShouldEqual, "@value")

			movingAvgAgg := firstLevel.Aggregation.Aggs[1]
			So(movingAvgAgg.Key, ShouldEqual, "2")
			So(movingAvgAgg.Aggregation.Type, ShouldEqual, "moving_avg")
			pl := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			So(pl.BucketPath, ShouldEqual, "3")
		})

		Convey("With broken moving average", func() {
			c := newFakeClient(5)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "5" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "moving_avg",
						"pipelineAgg": "3"
					},
					{
						"id": "4",
						"type": "moving_avg",
						"pipelineAgg": "Metric to apply moving average"
					}
				]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "5")
			So(firstLevel.Aggregation.Type, ShouldEqual, "date_histogram")

			So(firstLevel.Aggregation.Aggs, ShouldHaveLength, 2)

			movingAvgAgg := firstLevel.Aggregation.Aggs[1]
			So(movingAvgAgg.Key, ShouldEqual, "2")
			plAgg := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			So(plAgg.BucketPath, ShouldEqual, "3")
		})

		Convey("With derivative", func() {
			c := newFakeClient(5)
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "derivative",
						"pipelineAgg": "3"
					}
				]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "4")
			So(firstLevel.Aggregation.Type, ShouldEqual, "date_histogram")

			derivativeAgg := firstLevel.Aggregation.Aggs[1]
			So(derivativeAgg.Key, ShouldEqual, "2")
			plAgg := derivativeAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			So(plAgg.BucketPath, ShouldEqual, "3")
		})

	})
}

type fakeClient struct {
	version             int
	timeField           string
	multiSearchResponse *es.MultiSearchResponse
	multiSearchError    error
	builder             *es.MultiSearchRequestBuilder
	multisearchRequests []*es.MultiSearchRequest
}

func newFakeClient(version int) *fakeClient {
	return &fakeClient{
		version:             version,
		timeField:           "@timestamp",
		multisearchRequests: make([]*es.MultiSearchRequest, 0),
		multiSearchResponse: &es.MultiSearchResponse{},
	}
}

func (c *fakeClient) GetVersion() int {
	return c.version
}

func (c *fakeClient) GetTimeField() string {
	return c.timeField
}

func (c *fakeClient) GetMinInterval(queryInterval string) (time.Duration, error) {
	return 15 * time.Second, nil
}

func (c *fakeClient) ExecuteMultisearch(r *es.MultiSearchRequest) (*es.MultiSearchResponse, error) {
	c.multisearchRequests = append(c.multisearchRequests, r)
	return c.multiSearchResponse, c.multiSearchError
}

func (c *fakeClient) MultiSearch() *es.MultiSearchRequestBuilder {
	c.builder = es.NewMultiSearchRequestBuilder(c.version)
	return c.builder
}

func newTsdbQuery(body string) (*tsdb.TsdbQuery, error) {
	json, err := simplejson.NewJson([]byte(body))
	if err != nil {
		return nil, err
	}
	return &tsdb.TsdbQuery{
		Queries: []*tsdb.Query{
			{
				Model: json,
			},
		},
	}, nil
}

func executeTsdbQuery(c es.Client, body string, from, to time.Time, minInterval time.Duration) (*tsdb.Response, error) {
	json, err := simplejson.NewJson([]byte(body))
	if err != nil {
		return nil, err
	}
	fromStr := fmt.Sprintf("%d", from.UnixNano()/int64(time.Millisecond))
	toStr := fmt.Sprintf("%d", to.UnixNano()/int64(time.Millisecond))
	tsdbQuery := &tsdb.TsdbQuery{
		Queries: []*tsdb.Query{
			{
				Model: json,
			},
		},
		TimeRange: tsdb.NewTimeRange(fromStr, toStr),
	}
	query := newTimeSeriesQuery(c, tsdbQuery, tsdb.NewIntervalCalculator(&tsdb.IntervalOptions{MinInterval: minInterval}))
	return query.execute()
}

func TestTimeSeriesQueryParser(t *testing.T) {
	Convey("Test time series query parser", t, func() {
		p := newTimeSeriesQueryParser()

		Convey("Should be able to parse query", func() {
			body := `{
				"timeField": "@timestamp",
				"query": "@metric:cpu",
				"alias": "{{@hostname}} {{metric}}",
				"metrics": [
					{
						"field": "@value",
						"id": "1",
						"meta": {},
						"settings": {
							"percents": [
								"90"
							]
						},
						"type": "percentiles"
					},
					{
						"type": "count",
						"field": "select field",
						"id": "4",
						"settings": {},
						"meta": {}
					}
				],
				"bucketAggs": [
					{
						"fake": true,
						"field": "@hostname",
						"id": "3",
						"settings": {
							"min_doc_count": 1,
							"order": "desc",
							"orderBy": "_term",
							"size": "10"
						},
						"type": "terms"
					},
					{
						"field": "@timestamp",
						"id": "2",
						"settings": {
							"interval": "5m",
							"min_doc_count": 0,
							"trimEdges": 0
						},
						"type": "date_histogram"
					}
				]
			}`
			tsdbQuery, err := newTsdbQuery(body)
			So(err, ShouldBeNil)
			queries, err := p.parse(tsdbQuery)
			So(err, ShouldBeNil)
			So(queries, ShouldHaveLength, 1)

			q := queries[0]

			So(q.TimeField, ShouldEqual, "@timestamp")
			So(q.RawQuery, ShouldEqual, "@metric:cpu")
			So(q.Alias, ShouldEqual, "{{@hostname}} {{metric}}")

			So(q.Metrics, ShouldHaveLength, 2)
			So(q.Metrics[0].Field, ShouldEqual, "@value")
			So(q.Metrics[0].ID, ShouldEqual, "1")
			So(q.Metrics[0].Type, ShouldEqual, "percentiles")
			So(q.Metrics[0].Hide, ShouldBeFalse)
			So(q.Metrics[0].PipelineAggregate, ShouldEqual, "")
			So(q.Metrics[0].Settings.Get("percents").MustStringArray()[0], ShouldEqual, "90")

			So(q.Metrics[1].Field, ShouldEqual, "select field")
			So(q.Metrics[1].ID, ShouldEqual, "4")
			So(q.Metrics[1].Type, ShouldEqual, "count")
			So(q.Metrics[1].Hide, ShouldBeFalse)
			So(q.Metrics[1].PipelineAggregate, ShouldEqual, "")
			So(q.Metrics[1].Settings.MustMap(), ShouldBeEmpty)

			So(q.BucketAggs, ShouldHaveLength, 2)
			So(q.BucketAggs[0].Field, ShouldEqual, "@hostname")
			So(q.BucketAggs[0].ID, ShouldEqual, "3")
			So(q.BucketAggs[0].Type, ShouldEqual, "terms")
			So(q.BucketAggs[0].Settings.Get("min_doc_count").MustInt64(), ShouldEqual, 1)
			So(q.BucketAggs[0].Settings.Get("order").MustString(), ShouldEqual, "desc")
			So(q.BucketAggs[0].Settings.Get("orderBy").MustString(), ShouldEqual, "_term")
			So(q.BucketAggs[0].Settings.Get("size").MustString(), ShouldEqual, "10")

			So(q.BucketAggs[1].Field, ShouldEqual, "@timestamp")
			So(q.BucketAggs[1].ID, ShouldEqual, "2")
			So(q.BucketAggs[1].Type, ShouldEqual, "date_histogram")
			So(q.BucketAggs[1].Settings.Get("interval").MustString(), ShouldEqual, "5m")
			So(q.BucketAggs[1].Settings.Get("min_doc_count").MustInt64(), ShouldEqual, 0)
			So(q.BucketAggs[1].Settings.Get("trimEdges").MustInt64(), ShouldEqual, 0)
		})
	})
}
