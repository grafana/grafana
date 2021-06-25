package elasticsearch

import (
	"fmt"
	"testing"
	"time"

	"github.com/Masterminds/semver"
	"github.com/grafana/grafana/pkg/plugins"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
	"github.com/grafana/grafana/pkg/tsdb/interval"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/components/simplejson"
	. "github.com/smartystreets/goconvey/convey"
)

func TestExecuteTimeSeriesQuery(t *testing.T) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	fromStr := fmt.Sprintf("%d", from.UnixNano()/int64(time.Millisecond))
	toStr := fmt.Sprintf("%d", to.UnixNano()/int64(time.Millisecond))

	Convey("Test execute time series query", t, func() {
		Convey("With defaults on es 2", func() {
			c := newFakeClient("2.0.0")
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
			c := newFakeClient("5.0.0")
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
			c := newFakeClient("5.0.0")
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
			c := newFakeClient("5.0.0")
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
			c := newFakeClient("5.0.0")
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

		Convey("With term agg and order by count metric agg", func() {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"type": "terms",
						"field": "@host",
						"id": "2",
						"settings": { "size": "5", "order": "asc", "orderBy": "1"	}
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
					{"type": "count", "id": "1" }
				]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			termsAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.TermsAggregation)
			So(termsAgg.Order["_count"], ShouldEqual, "asc")
		})

		Convey("With term agg and order by percentiles agg", func() {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"type": "terms",
						"field": "@host",
						"id": "2",
						"settings": { "size": "5", "order": "asc", "orderBy": "1[95.0]"	}
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
        {"type": "percentiles", "field": "@value", "id": "1", "settings": { "percents": ["95","99"] } }
				]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			orderByAgg := sr.Aggs[0].Aggregation.Aggs[0]
			So(orderByAgg.Key, ShouldEqual, "1")
			So(orderByAgg.Aggregation.Type, ShouldEqual, "percentiles")
		})

		Convey("With term agg and order by extended stats agg", func() {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"type": "terms",
						"field": "@host",
						"id": "2",
						"settings": { "size": "5", "order": "asc", "orderBy": "1[std_deviation]"	}
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
        {"type": "extended_stats", "field": "@value", "id": "1", "meta": { "std_deviation": true } }
				]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			orderByAgg := sr.Aggs[0].Aggregation.Aggs[0]
			So(orderByAgg.Key, ShouldEqual, "1")
			So(orderByAgg.Aggregation.Type, ShouldEqual, "extended_stats")
		})

		Convey("With term agg and order by term", func() {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"type": "terms",
						"field": "@host",
						"id": "2",
						"settings": { "size": "5", "order": "asc", "orderBy": "_term"	}
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

			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "2")
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)
			So(termsAgg.Order["_term"], ShouldEqual, "asc")
		})

		Convey("With term agg and order by term with es6.x", func() {
			c := newFakeClient("6.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{
						"type": "terms",
						"field": "@host",
						"id": "2",
						"settings": { "size": "5", "order": "asc", "orderBy": "_term"	}
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

			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "2")
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)
			So(termsAgg.Order["_key"], ShouldEqual, "asc")
		})

		Convey("With metric percentiles", func() {
			c := newFakeClient("5.0.0")
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
			c := newFakeClient("2.0.0")
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
			c := newFakeClient("5.0.0")
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
			c := newFakeClient("5.0.0")
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
			c := newFakeClient("5.0.0")
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
			c := newFakeClient("5.0.0")
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
			c := newFakeClient("5.0.0")
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
			c := newFakeClient("5.0.0")
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
			c := newFakeClient("5.0.0")
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

		Convey("With moving average doc count", func() {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "count", "field": "select field" },
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
			So(firstLevel.Aggregation.Aggs, ShouldHaveLength, 1)

			movingAvgAgg := firstLevel.Aggregation.Aggs[0]
			So(movingAvgAgg.Key, ShouldEqual, "2")
			So(movingAvgAgg.Aggregation.Type, ShouldEqual, "moving_avg")
			pl := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			So(pl.BucketPath, ShouldEqual, "_count")
		})

		Convey("With broken moving average", func() {
			c := newFakeClient("5.0.0")
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

		Convey("With cumulative sum", func() {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "cumulative_sum",
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

			cumulativeSumAgg := firstLevel.Aggregation.Aggs[1]
			So(cumulativeSumAgg.Key, ShouldEqual, "2")
			So(cumulativeSumAgg.Aggregation.Type, ShouldEqual, "cumulative_sum")
			pl := cumulativeSumAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			So(pl.BucketPath, ShouldEqual, "3")
		})

		Convey("With cumulative sum doc count", func() {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "count", "field": "select field" },
					{
						"id": "2",
						"type": "cumulative_sum",
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
			So(firstLevel.Aggregation.Aggs, ShouldHaveLength, 1)

			cumulativeSumAgg := firstLevel.Aggregation.Aggs[0]
			So(cumulativeSumAgg.Key, ShouldEqual, "2")
			So(cumulativeSumAgg.Aggregation.Type, ShouldEqual, "cumulative_sum")
			pl := cumulativeSumAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			So(pl.BucketPath, ShouldEqual, "_count")
		})

		Convey("With broken cumulative sum", func() {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "5" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "cumulative_sum",
						"pipelineAgg": "3"
					},
					{
						"id": "4",
						"type": "cumulative_sum",
						"pipelineAgg": "Metric to apply cumulative sum"
					}
				]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "5")
			So(firstLevel.Aggregation.Type, ShouldEqual, "date_histogram")

			So(firstLevel.Aggregation.Aggs, ShouldHaveLength, 2)

			cumulativeSumAgg := firstLevel.Aggregation.Aggs[1]
			So(cumulativeSumAgg.Key, ShouldEqual, "2")
			plAgg := cumulativeSumAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			So(plAgg.BucketPath, ShouldEqual, "3")
		})

		Convey("With derivative", func() {
			c := newFakeClient("5.0.0")
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

		Convey("With derivative doc count", func() {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "count", "field": "select field" },
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

			derivativeAgg := firstLevel.Aggregation.Aggs[0]
			So(derivativeAgg.Key, ShouldEqual, "2")
			plAgg := derivativeAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			So(plAgg.BucketPath, ShouldEqual, "_count")
		})

		Convey("With serial_diff", func() {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "serial_diff",
						"pipelineAgg": "3"
					}
				]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "4")
			So(firstLevel.Aggregation.Type, ShouldEqual, "date_histogram")

			serialDiffAgg := firstLevel.Aggregation.Aggs[1]
			So(serialDiffAgg.Key, ShouldEqual, "2")
			plAgg := serialDiffAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			So(plAgg.BucketPath, ShouldEqual, "3")
		})

		Convey("With serial_diff doc count", func() {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "count", "field": "select field" },
					{
						"id": "2",
						"type": "serial_diff",
						"pipelineAgg": "3"
					}
				]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "4")
			So(firstLevel.Aggregation.Type, ShouldEqual, "date_histogram")

			serialDiffAgg := firstLevel.Aggregation.Aggs[0]
			So(serialDiffAgg.Key, ShouldEqual, "2")
			plAgg := serialDiffAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			So(plAgg.BucketPath, ShouldEqual, "_count")
		})

		Convey("With bucket_script", func() {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{ "id": "5", "type": "max", "field": "@value" },
					{
						"id": "2",
						"type": "bucket_script",
						"pipelineVariables": [
							{ "name": "var1", "pipelineAgg": "3" },
							{ "name": "var2", "pipelineAgg": "5" }
						],
						"settings": { "script": "params.var1 * params.var2" }
					}
				]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "4")
			So(firstLevel.Aggregation.Type, ShouldEqual, "date_histogram")

			bucketScriptAgg := firstLevel.Aggregation.Aggs[2]
			So(bucketScriptAgg.Key, ShouldEqual, "2")
			plAgg := bucketScriptAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			So(plAgg.BucketPath.(map[string]interface{}), ShouldResemble, map[string]interface{}{
				"var1": "3",
				"var2": "5",
			})
		})

		Convey("With bucket_script doc count", func() {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "count", "field": "select field" },
					{
						"id": "2",
						"type": "bucket_script",
						"pipelineVariables": [
							{ "name": "var1", "pipelineAgg": "3" }
						],
						"settings": { "script": "params.var1 * 1000" }
					}
				]
			}`, from, to, 15*time.Second)
			So(err, ShouldBeNil)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			So(firstLevel.Key, ShouldEqual, "4")
			So(firstLevel.Aggregation.Type, ShouldEqual, "date_histogram")

			bucketScriptAgg := firstLevel.Aggregation.Aggs[0]
			So(bucketScriptAgg.Key, ShouldEqual, "2")
			plAgg := bucketScriptAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			So(plAgg.BucketPath.(map[string]interface{}), ShouldResemble, map[string]interface{}{
				"var1": "_count",
			})
		})
	})
}

func TestSettingsCasting(t *testing.T) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)

	t.Run("Correctly transforms moving_average settings", func(t *testing.T) {
		c := newFakeClient("5.0.0")
		_, err := executeTsdbQuery(c, `{
			"timeField": "@timestamp",
			"bucketAggs": [
				{ "type": "date_histogram", "field": "@timestamp", "id": "2" }
			],
			"metrics": [
				{ "id": "1", "type": "average", "field": "@value" },
				{
					"id": "3",
					"type": "moving_avg",
					"field": "1",
					"pipelineAgg": "1",
					"settings": {
						"model": "holt_winters",
						"window": "10",
						"predict": "5",
						"settings": {
							"alpha": "0.5",
							"beta": "0.7",
							"gamma": "SHOULD NOT CHANGE",
							"period": "4"
						}
					}
				}
			]
		}`, from, to, 15*time.Second)
		assert.Nil(t, err)
		sr := c.multisearchRequests[0].Requests[0]

		movingAvgSettings := sr.Aggs[0].Aggregation.Aggs[1].Aggregation.Aggregation.(*es.PipelineAggregation).Settings

		assert.Equal(t, 10., movingAvgSettings["window"])
		assert.Equal(t, 5., movingAvgSettings["predict"])

		modelSettings := movingAvgSettings["settings"].(map[string]interface{})

		assert.Equal(t, .5, modelSettings["alpha"])
		assert.Equal(t, .7, modelSettings["beta"])
		assert.Equal(t, "SHOULD NOT CHANGE", modelSettings["gamma"])
		assert.Equal(t, 4., modelSettings["period"])
	})

	t.Run("Correctly transforms serial_diff settings", func(t *testing.T) {
		c := newFakeClient("5.0.0")
		_, err := executeTsdbQuery(c, `{
			"timeField": "@timestamp",
			"bucketAggs": [
				{ "type": "date_histogram", "field": "@timestamp", "id": "2" }
			],
			"metrics": [
				{ "id": "1", "type": "average", "field": "@value" },
				{
					"id": "3",
					"type": "serial_diff",
					"field": "1",
					"pipelineAgg": "1",
					"settings": {
						"lag": "1"
					}
				}
			]
		}`, from, to, 15*time.Second)
		assert.Nil(t, err)
		sr := c.multisearchRequests[0].Requests[0]

		serialDiffSettings := sr.Aggs[0].Aggregation.Aggs[1].Aggregation.Aggregation.(*es.PipelineAggregation).Settings

		assert.Equal(t, 1., serialDiffSettings["lag"])
	})

	t.Run("Date Histogram Settings", func(t *testing.T) {
		t.Run("Correctly transforms date_histogram settings", func(t *testing.T) {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ 
						"type": "date_histogram",
						"field": "@timestamp",
						"id": "2",
						"settings": {
							"min_doc_count": "1" 
						}
					}
				],
				"metrics": [
					{ "id": "1", "type": "average", "field": "@value" },
					{
						"id": "3",
						"type": "serial_diff",
						"field": "1",
						"pipelineAgg": "1",
						"settings": {
							"lag": "1"
						}
					}
				]
			}`, from, to, 15*time.Second)
			assert.Nil(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)

			assert.Equal(t, 1, dateHistogramAgg.MinDocCount)
		})

		t.Run("Correctly uses already int min_doc_count", func(t *testing.T) {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ 
						"type": "date_histogram",
						"field": "@timestamp",
						"id": "2",
						"settings": {
							"min_doc_count": 10
						}
					}
				],
				"metrics": [
					{ "id": "1", "type": "average", "field": "@value" },
					{
						"id": "3",
						"type": "serial_diff",
						"field": "1",
						"pipelineAgg": "1",
						"settings": {
							"lag": "1"
						}
					}
				]
			}`, from, to, 15*time.Second)
			assert.Nil(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)

			assert.Equal(t, 10, dateHistogramAgg.MinDocCount)
		})
	})

	t.Run("Inline Script", func(t *testing.T) {
		t.Run("Correctly handles scripts for ES < 5.6", func(t *testing.T) {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "2" }
				],
				"metrics": [
					{
						"id": "1",
						"type": "avg",
						"settings": {
							"script": "my_script"
						}
					},
					{
						"id": "3",
						"type": "avg",
						"settings": {
							"script": {
								"inline": "my_script"
							}
						}
					}
				]
			}`, from, to, 15*time.Second)

			assert.Nil(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			newFormatAggSettings := sr.Aggs[0].Aggregation.Aggs[0].Aggregation.Aggregation.(*es.MetricAggregation).Settings
			oldFormatAggSettings := sr.Aggs[0].Aggregation.Aggs[1].Aggregation.Aggregation.(*es.MetricAggregation).Settings

			assert.Equal(t, map[string]interface{}{"inline": "my_script"}, newFormatAggSettings["script"])
			assert.Equal(t, map[string]interface{}{"inline": "my_script"}, oldFormatAggSettings["script"])
		})

		t.Run("Correctly handles scripts for ES >= 5.6", func(t *testing.T) {
			c := newFakeClient("5.6.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "2" }
				],
				"metrics": [
					{
						"id": "1",
						"type": "avg",
						"settings": {
							"script": "my_script"
						}
					},
					{ 
						"id": "3",
						"type": "avg",
						"settings": {
							"script": {
								"inline": "my_script"
							}
						}
					}
				]
			}`, from, to, 15*time.Second)

			assert.Nil(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			newFormatAggSettings := sr.Aggs[0].Aggregation.Aggs[0].Aggregation.Aggregation.(*es.MetricAggregation).Settings
			oldFormatAggSettings := sr.Aggs[0].Aggregation.Aggs[1].Aggregation.Aggregation.(*es.MetricAggregation).Settings

			assert.Equal(t, "my_script", newFormatAggSettings["script"])
			assert.Equal(t, "my_script", oldFormatAggSettings["script"])
		})
	})
}

type fakeClient struct {
	version             *semver.Version
	timeField           string
	multiSearchResponse *es.MultiSearchResponse
	multiSearchError    error
	builder             *es.MultiSearchRequestBuilder
	multisearchRequests []*es.MultiSearchRequest
}

func newFakeClient(versionString string) *fakeClient {
	version, _ := semver.NewVersion(versionString)
	return &fakeClient{
		version:             version,
		timeField:           "@timestamp",
		multisearchRequests: make([]*es.MultiSearchRequest, 0),
		multiSearchResponse: &es.MultiSearchResponse{},
	}
}

func (c *fakeClient) EnableDebug() {}

func (c *fakeClient) GetVersion() *semver.Version {
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

func newDataQuery(body string) (plugins.DataQuery, error) {
	json, err := simplejson.NewJson([]byte(body))
	if err != nil {
		return plugins.DataQuery{}, err
	}
	return plugins.DataQuery{
		Queries: []plugins.DataSubQuery{
			{
				Model: json,
			},
		},
	}, nil
}

// nolint:staticcheck // plugins.DataQueryResult deprecated
func executeTsdbQuery(c es.Client, body string, from, to time.Time, minInterval time.Duration) (
	plugins.DataResponse, error) {
	json, err := simplejson.NewJson([]byte(body))
	if err != nil {
		return plugins.DataResponse{}, err
	}
	fromStr := fmt.Sprintf("%d", from.UnixNano()/int64(time.Millisecond))
	toStr := fmt.Sprintf("%d", to.UnixNano()/int64(time.Millisecond))
	timeRange := plugins.NewDataTimeRange(fromStr, toStr)
	tsdbQuery := plugins.DataQuery{
		Queries: []plugins.DataSubQuery{
			{
				Model: json,
			},
		},
		TimeRange: &timeRange,
	}
	query := newTimeSeriesQuery(c, tsdbQuery, interval.NewCalculator(interval.CalculatorOptions{MinInterval: minInterval}))
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
        "interval": "10m",
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
			tsdbQuery, err := newDataQuery(body)
			So(err, ShouldBeNil)
			queries, err := p.parse(tsdbQuery)
			So(err, ShouldBeNil)
			So(queries, ShouldHaveLength, 1)

			q := queries[0]

			So(q.TimeField, ShouldEqual, "@timestamp")
			So(q.RawQuery, ShouldEqual, "@metric:cpu")
			So(q.Alias, ShouldEqual, "{{@hostname}} {{metric}}")
			So(q.Interval, ShouldEqual, "10m")

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
