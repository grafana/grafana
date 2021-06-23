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
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

func TestExecuteTimeSeriesQuery(t *testing.T) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	fromStr := fmt.Sprintf("%d", from.UnixNano()/int64(time.Millisecond))
	toStr := fmt.Sprintf("%d", to.UnixNano()/int64(time.Millisecond))

	t.Run("Test execute time series query", func(t *testing.T) {
		t.Run("With defaults on es 2", func(t *testing.T) {
			c := newFakeClient("2.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "2" }],
				"metrics": [{"type": "count", "id": "0" }]
			}`, from, to, 15*time.Second)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			rangeFilter := sr.Query.Bool.Filters[0].(*es.RangeFilter)
			require.Equal(t, c.timeField, rangeFilter.Key)
			require.Equal(t, toStr, rangeFilter.Lte)
			require.Equal(t, fromStr, rangeFilter.Gte)
			require.Equal(t, es.DateFormatEpochMS, rangeFilter.Format)
			require.Equal(t, "2", sr.Aggs[0].Key)
			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)
			require.Equal(t, "@timestamp", dateHistogramAgg.Field)
			require.Equal(t, fromStr, dateHistogramAgg.ExtendedBounds.Min)
			require.Equal(t, toStr, dateHistogramAgg.ExtendedBounds.Max)
		})

		t.Run("With defaults on es 5", func(t *testing.T) {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "2" }],
				"metrics": [{"type": "count", "id": "0" }]
			}`, from, to, 15*time.Second)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			require.Equal(t, c.timeField, sr.Query.Bool.Filters[0].(*es.RangeFilter).Key)
			require.Equal(t, "2", sr.Aggs[0].Key)
			require.Equal(t, fromStr, sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg).ExtendedBounds.Min)
			require.Equal(t, toStr, sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg).ExtendedBounds.Max)
		})

		t.Run("With multiple bucket aggs", func(t *testing.T) {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "terms", "field": "@host", "id": "2", "settings": { "size": "0", "order": "asc" } },
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to, 15*time.Second)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			require.Equal(t, "2", firstLevel.Key)
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)
			require.Equal(t, "@host", termsAgg.Field)
			require.Equal(t, 500, termsAgg.Size)
			secondLevel := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, "3", secondLevel.Key)
			require.Equal(t, "@timestamp", secondLevel.Aggregation.Aggregation.(*es.DateHistogramAgg).Field)
		})

		t.Run("With select field", func(t *testing.T) {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "2" }
				],
				"metrics": [{"type": "avg", "field": "@value", "id": "1" }]
			}`, from, to, 15*time.Second)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			require.Equal(t, "2", firstLevel.Key)
			require.Equal(t, "@timestamp", firstLevel.Aggregation.Aggregation.(*es.DateHistogramAgg).Field)
			secondLevel := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, "1", secondLevel.Key)
			require.Equal(t, "avg", secondLevel.Aggregation.Type)
			require.Equal(t, "@value", secondLevel.Aggregation.Aggregation.(*es.MetricAggregation).Field)
		})

		t.Run("With term agg and order by metric agg", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			avgAggOrderBy := sr.Aggs[0].Aggregation.Aggs[0]
			require.Equal(t, "5", avgAggOrderBy.Key)
			require.Equal(t, "avg", avgAggOrderBy.Aggregation.Type)

			avgAgg := sr.Aggs[0].Aggregation.Aggs[1].Aggregation.Aggs[0]
			require.Equal(t, "5", avgAgg.Key)
			require.Equal(t, "avg", avgAgg.Aggregation.Type)
		})

		t.Run("With term agg and order by count metric agg", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			termsAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.TermsAggregation)
			require.Equal(t, "asc", termsAgg.Order["_count"])
		})

		t.Run("With term agg and order by percentiles agg", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			orderByAgg := sr.Aggs[0].Aggregation.Aggs[0]
			require.Equal(t, "1", orderByAgg.Key)
			require.Equal(t, "percentiles", orderByAgg.Aggregation.Type)
		})

		t.Run("With term agg and order by extended stats agg", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			orderByAgg := sr.Aggs[0].Aggregation.Aggs[0]
			require.Equal(t, "1", orderByAgg.Key)
			require.Equal(t, "extended_stats", orderByAgg.Aggregation.Type)
		})

		t.Run("With term agg and order by term", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "2", firstLevel.Key)
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)
			require.Equal(t, "asc", termsAgg.Order["_term"])
		})

		t.Run("With term agg and order by term with es6.x", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "2", firstLevel.Key)
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)
			require.Equal(t, "asc", termsAgg.Order["_key"])
		})

		t.Run("With metric percentiles", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			percentilesAgg := sr.Aggs[0].Aggregation.Aggs[0]
			require.Equal(t, "1", percentilesAgg.Key)
			require.Equal(t, "percentiles", percentilesAgg.Aggregation.Type)
			metricAgg := percentilesAgg.Aggregation.Aggregation.(*es.MetricAggregation)
			percents := metricAgg.Settings["percents"].([]interface{})
			require.Equal(t, 4, len(percents))
			require.Equal(t, "1", percents[0])
			require.Equal(t, "2", percents[1])
			require.Equal(t, "3", percents[2])
			require.Equal(t, "4", percents[3])
		})

		t.Run("With filters aggs on es 2", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			filtersAgg := sr.Aggs[0]
			require.Equal(t, "2", filtersAgg.Key)
			require.Equal(t, "filters", filtersAgg.Aggregation.Type)
			fAgg := filtersAgg.Aggregation.Aggregation.(*es.FiltersAggregation)
			require.Equal(t, "@metric:cpu", fAgg.Filters["@metric:cpu"].(*es.QueryStringFilter).Query)
			require.Equal(t, "@metric:logins.count", fAgg.Filters["@metric:logins.count"].(*es.QueryStringFilter).Query)

			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggs[0]
			require.Equal(t, "4", dateHistogramAgg.Key)
			require.Equal(t, "@timestamp", dateHistogramAgg.Aggregation.Aggregation.(*es.DateHistogramAgg).Field)
		})

		t.Run("With filters aggs on es 5", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			filtersAgg := sr.Aggs[0]
			require.Equal(t, "2", filtersAgg.Key)
			require.Equal(t, "filters", filtersAgg.Aggregation.Type)
			fAgg := filtersAgg.Aggregation.Aggregation.(*es.FiltersAggregation)
			require.Equal(t, "@metric:cpu", fAgg.Filters["@metric:cpu"].(*es.QueryStringFilter).Query)
			require.Equal(t, "@metric:logins.count", fAgg.Filters["@metric:logins.count"].(*es.QueryStringFilter).Query)

			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggs[0]
			require.Equal(t, "4", dateHistogramAgg.Key)
			require.Equal(t, "@timestamp", dateHistogramAgg.Aggregation.Aggregation.(*es.DateHistogramAgg).Field)
		})

		t.Run("With raw document metric", func(t *testing.T) {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_document", "settings": {}	}]
			}`, from, to, 15*time.Second)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			require.Equal(t, 500, sr.Size)
		})

		t.Run("With raw document metric size set", func(t *testing.T) {
			c := newFakeClient("5.0.0")
			_, err := executeTsdbQuery(c, `{
				"timeField": "@timestamp",
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_document", "settings": { "size": 1337 }	}]
			}`, from, to, 15*time.Second)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			require.Equal(t, 1337, sr.Size)
		})

		t.Run("With date histogram agg", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "2", firstLevel.Key)
			require.Equal(t, "date_histogram", firstLevel.Aggregation.Type)
			hAgg := firstLevel.Aggregation.Aggregation.(*es.DateHistogramAgg)
			require.Equal(t, "@timestamp", hAgg.Field)
			require.Equal(t, "$__interval", hAgg.Interval)
			require.Equal(t, 2, hAgg.MinDocCount)
		})

		t.Run("With histogram agg", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "3", firstLevel.Key)
			require.Equal(t, "histogram", firstLevel.Aggregation.Type)
			hAgg := firstLevel.Aggregation.Aggregation.(*es.HistogramAgg)
			require.Equal(t, "bytes", hAgg.Field)
			require.Equal(t, 10, hAgg.Interval)
			require.Equal(t, 2, hAgg.MinDocCount)
			require.Equal(t, 5, *hAgg.Missing)
		})

		t.Run("With geo hash grid agg", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "3", firstLevel.Key)
			require.Equal(t, "geohash_grid", firstLevel.Aggregation.Type)
			ghGridAgg := firstLevel.Aggregation.Aggregation.(*es.GeoHashGridAggregation)
			require.Equal(t, "@location", ghGridAgg.Field)
			require.Equal(t, 3, ghGridAgg.Precision)
		})

		t.Run("With moving average", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "4", firstLevel.Key)
			require.Equal(t, "date_histogram", firstLevel.Aggregation.Type)
			require.Equal(t, 2, len(firstLevel.Aggregation.Aggs))

			sumAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, "3", sumAgg.Key)
			require.Equal(t, "sum", sumAgg.Aggregation.Type)
			mAgg := sumAgg.Aggregation.Aggregation.(*es.MetricAggregation)
			require.Equal(t, "@value", mAgg.Field)

			movingAvgAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, "2", movingAvgAgg.Key)
			require.Equal(t, "moving_avg", movingAvgAgg.Aggregation.Type)
			pl := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, "3", pl.BucketPath)
		})

		t.Run("With moving average doc count", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "4", firstLevel.Key)
			require.Equal(t, "date_histogram", firstLevel.Aggregation.Type)
			require.Equal(t, 1, len(firstLevel.Aggregation.Aggs))

			movingAvgAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, "2", movingAvgAgg.Key)
			require.Equal(t, "moving_avg", movingAvgAgg.Aggregation.Type)
			pl := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, "_count", pl.BucketPath)
		})

		t.Run("With broken moving average", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "5", firstLevel.Key)
			require.Equal(t, "date_histogram", firstLevel.Aggregation.Type)

			require.Equal(t, 2, len(firstLevel.Aggregation.Aggs))

			movingAvgAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, "2", movingAvgAgg.Key)
			plAgg := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, "3", plAgg.BucketPath)
		})

		t.Run("With cumulative sum", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "4", firstLevel.Key)
			require.Equal(t, "date_histogram", firstLevel.Aggregation.Type)
			require.Equal(t, 2, len(firstLevel.Aggregation.Aggs))

			sumAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, "3", sumAgg.Key)
			require.Equal(t, "sum", sumAgg.Aggregation.Type)
			mAgg := sumAgg.Aggregation.Aggregation.(*es.MetricAggregation)
			require.Equal(t, "@value", mAgg.Field)

			cumulativeSumAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, "2", cumulativeSumAgg.Key)
			require.Equal(t, "cumulative_sum", cumulativeSumAgg.Aggregation.Type)
			pl := cumulativeSumAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, "3", pl.BucketPath)
		})

		t.Run("With cumulative sum doc count", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "4", firstLevel.Key)
			require.Equal(t, "date_histogram", firstLevel.Aggregation.Type)
			require.Equal(t, 1, len(firstLevel.Aggregation.Aggs))

			cumulativeSumAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, "2", cumulativeSumAgg.Key)
			require.Equal(t, "cumulative_sum", cumulativeSumAgg.Aggregation.Type)
			pl := cumulativeSumAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, "_count", pl.BucketPath)
		})

		t.Run("With broken cumulative sum", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "5", firstLevel.Key)
			require.Equal(t, "date_histogram", firstLevel.Aggregation.Type)

			require.Equal(t, 2, len(firstLevel.Aggregation.Aggs))

			cumulativeSumAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, "2", cumulativeSumAgg.Key)
			plAgg := cumulativeSumAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, "3", plAgg.BucketPath)
		})

		t.Run("With derivative", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "4", firstLevel.Key)
			require.Equal(t, "date_histogram", firstLevel.Aggregation.Type)

			derivativeAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, "2", derivativeAgg.Key)
			plAgg := derivativeAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, "3", plAgg.BucketPath)
		})

		t.Run("With derivative doc count", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "4", firstLevel.Key)
			require.Equal(t, "date_histogram", firstLevel.Aggregation.Type)

			derivativeAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, "2", derivativeAgg.Key)
			plAgg := derivativeAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, "_count", plAgg.BucketPath)
		})

		t.Run("With serial_diff", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "4", firstLevel.Key)
			require.Equal(t, "date_histogram", firstLevel.Aggregation.Type)

			serialDiffAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, "2", serialDiffAgg.Key)
			plAgg := serialDiffAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, "3", plAgg.BucketPath)
		})

		t.Run("With serial_diff doc count", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "4", firstLevel.Key)
			require.Equal(t, "date_histogram", firstLevel.Aggregation.Type)

			serialDiffAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, "2", serialDiffAgg.Key)
			plAgg := serialDiffAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, "_count", plAgg.BucketPath)
		})

		t.Run("With bucket_script", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "4", firstLevel.Key)
			require.Equal(t, "date_histogram", firstLevel.Aggregation.Type)

			bucketScriptAgg := firstLevel.Aggregation.Aggs[2]
			require.Equal(t, "2", bucketScriptAgg.Key)
			plAgg := bucketScriptAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			So(plAgg.BucketPath.(map[string]interface{}), ShouldResemble, map[string]interface{}{
				"var1": "3",
				"var2": "5",
			})
		})

		t.Run("With bucket_script doc count", func(t *testing.T) {
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
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, "4", firstLevel.Key)
			require.Equal(t, "date_histogram", firstLevel.Aggregation.Type)

			bucketScriptAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, "2", bucketScriptAgg.Key)
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
	t.Run("Test time series query parser", func(t *testing.T) {
		p := newTimeSeriesQueryParser()

		t.Run("Should be able to parse query", func(t *testing.T) {
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
			require.NoError(t, err)
			queries, err := p.parse(tsdbQuery)
			require.NoError(t, err)
			require.Equal(t, 1, len(queries))

			q := queries[0]

			require.Equal(t, "@timestamp", q.TimeField)
			require.Equal(t, "@metric:cpu", q.RawQuery)
			require.Equal(t, "{{@hostname}} {{metric}}", q.Alias)
			require.Equal(t, "10m", q.Interval)

			require.Equal(t, 2, len(q.Metrics))
			require.Equal(t, "@value", q.Metrics[0].Field)
			require.Equal(t, "1", q.Metrics[0].ID)
			require.Equal(t, "percentiles", q.Metrics[0].Type)
			require.False(t, q.Metrics[0].Hide)
			require.Equal(t, "", q.Metrics[0].PipelineAggregate)
			require.Equal(t, "90", q.Metrics[0].Settings.Get("percents").MustStringArray()[0])

			require.Equal(t, "select field", q.Metrics[1].Field)
			require.Equal(t, "4", q.Metrics[1].ID)
			require.Equal(t, "count", q.Metrics[1].Type)
			require.False(t, q.Metrics[1].Hide)
			require.Equal(t, "", q.Metrics[1].PipelineAggregate)
			require.Empty(t, q.Metrics[1].Settings.MustMap())

			require.Equal(t, 2, len(q.BucketAggs))
			require.Equal(t, "@hostname", q.BucketAggs[0].Field)
			require.Equal(t, "3", q.BucketAggs[0].ID)
			require.Equal(t, "terms", q.BucketAggs[0].Type)
			require.Equal(t, 1, q.BucketAggs[0].Settings.Get("min_doc_count").MustInt64())
			require.Equal(t, "desc", q.BucketAggs[0].Settings.Get("order").MustString())
			require.Equal(t, "_term", q.BucketAggs[0].Settings.Get("orderBy").MustString())
			require.Equal(t, "10", q.BucketAggs[0].Settings.Get("size").MustString())

			require.Equal(t, "@timestamp", q.BucketAggs[1].Field)
			require.Equal(t, "2", q.BucketAggs[1].ID)
			require.Equal(t, "date_histogram", q.BucketAggs[1].Type)
			require.Equal(t, "5m", q.BucketAggs[1].Settings.Get("interval").MustString())
			require.Equal(t, 0, q.BucketAggs[1].Settings.Get("min_doc_count").MustInt64())
			require.Equal(t, 0, q.BucketAggs[1].Settings.Get("trimEdges").MustInt64())
		})
	})
}
