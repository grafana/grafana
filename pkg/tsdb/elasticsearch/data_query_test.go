package elasticsearch

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

func TestExecuteElasticsearchDataQuery(t *testing.T) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	fromMs := from.UnixNano() / int64(time.Millisecond)
	toMs := to.UnixNano() / int64(time.Millisecond)

	t.Run("Test execute time series query", func(t *testing.T) {
		t.Run("With defaults", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "2" }],
				"metrics": [{"type": "count", "id": "0" }]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			rangeFilter := sr.Query.Bool.Filters[0].(*es.RangeFilter)
			require.Equal(t, rangeFilter.Key, c.configuredFields.TimeField)
			require.Equal(t, rangeFilter.Lte, toMs)
			require.Equal(t, rangeFilter.Gte, fromMs)
			require.Equal(t, rangeFilter.Format, es.DateFormatEpochMS)
			require.Equal(t, sr.Aggs[0].Key, "2")
			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)
			require.Equal(t, dateHistogramAgg.Field, "@timestamp")
			require.Equal(t, dateHistogramAgg.ExtendedBounds.Min, fromMs)
			require.Equal(t, dateHistogramAgg.ExtendedBounds.Max, toMs)
		})
		t.Run("Should clean settings from null values (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "1" }],
				"metrics": [{"type": "avg", "id": "0", "settings": {"missing": "null", "script": "1" } }]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			secondLevel := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, secondLevel.Aggregation.Aggregation.(*es.MetricAggregation).Settings["script"], "1")
			require.NotContains(t, secondLevel.Aggregation.Aggregation.(*es.MetricAggregation).Settings, "missing")
		})

		t.Run("With multiple bucket aggs", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{ "type": "terms", "field": "@host", "id": "2", "settings": { "size": "0", "order": "asc" } },
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "2")
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)
			require.Equal(t, termsAgg.Field, "@host")
			require.Equal(t, termsAgg.Size, defaultSize)
			secondLevel := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, secondLevel.Key, "3")
			require.Equal(t, secondLevel.Aggregation.Aggregation.(*es.DateHistogramAgg).Field, "@timestamp")
		})

		t.Run("With select field", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "2" }
				],
				"metrics": [{"type": "avg", "field": "@value", "id": "1" }]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "2")
			require.Equal(t, firstLevel.Aggregation.Aggregation.(*es.DateHistogramAgg).Field, "@timestamp")
			secondLevel := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, secondLevel.Key, "1")
			require.Equal(t, secondLevel.Aggregation.Type, "avg")
			require.Equal(t, secondLevel.Aggregation.Aggregation.(*es.MetricAggregation).Field, "@value")
		})

		t.Run("With term agg and order by term (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Aggregation.Aggregation.(*es.TermsAggregation).Order["_key"], "asc")
		})

		t.Run("With term agg and order by metric agg", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			avgAggOrderBy := sr.Aggs[0].Aggregation.Aggs[0]
			require.Equal(t, avgAggOrderBy.Key, "5")
			require.Equal(t, avgAggOrderBy.Aggregation.Type, "avg")
			require.Equal(t, avgAggOrderBy.Aggregation.Aggregation.(*es.MetricAggregation).Field, "@value")

			avgAgg := sr.Aggs[0].Aggregation.Aggs[1].Aggregation.Aggs[0]
			require.Equal(t, avgAgg.Key, "5")
			require.Equal(t, avgAgg.Aggregation.Type, "avg")
			require.Equal(t, avgAgg.Aggregation.Aggregation.(*es.MetricAggregation).Field, "@value")
		})

		t.Run("With term agg and order by count metric agg", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			termsAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.TermsAggregation)
			require.Equal(t, termsAgg.Order["_count"], "asc")
		})

		t.Run("With term agg and order by count agg (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"metrics": [
					{"type": "count", "id": "1" },
					{"type": "avg", "field": "@value", "id": "5" }
				],
				"bucketAggs": [
					{
						"type": "terms",
						"field": "@host",
						"id": "2",
						"settings": { "size": "5", "order": "asc", "orderBy": "1"	}
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)

			require.Equal(t, termsAgg.Order["_count"], "asc")
			require.NotEqual(t, firstLevel.Aggregation.Aggs[0].Key, "1")
		})

		t.Run("With term agg and order by percentiles agg", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			orderByAgg := sr.Aggs[0].Aggregation.Aggs[0]
			secondLevel := orderByAgg.Aggregation.Aggregation

			require.Equal(t, orderByAgg.Key, "1")
			require.Equal(t, orderByAgg.Aggregation.Type, "percentiles")
			require.Equal(t, orderByAgg.Aggregation.Aggregation.(*es.MetricAggregation).Field, "@value")
			require.Equal(t, secondLevel.(*es.MetricAggregation).Field, "@value")
		})

		t.Run("With term agg and order by extended stats agg", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			orderByAgg := firstLevel.Aggregation.Aggs[0]
			secondLevel := orderByAgg.Aggregation.Aggregation

			require.Equal(t, orderByAgg.Key, "1")
			require.Equal(t, orderByAgg.Aggregation.Type, "extended_stats")
			require.Equal(t, orderByAgg.Aggregation.Aggregation.(*es.MetricAggregation).Field, "@value")
			require.Equal(t, secondLevel.(*es.MetricAggregation).Field, "@value")
		})

		t.Run("With term agg and order by term", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "2")
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)
			require.Equal(t, termsAgg.Order["_key"], "asc")
		})

		t.Run("With term agg and valid min_doc_count (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{
						"type": "terms",
						"field": "@host",
						"id": "2",
						"settings": { "min_doc_count": "1" }
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
					{"type": "count", "id": "1" }
				]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "2")
			termsAgg := firstLevel.Aggregation.Aggregation.(*es.TermsAggregation)
			expectedMinDocCount := 1
			require.Equal(t, termsAgg.MinDocCount, &expectedMinDocCount)
		})

		t.Run("With metric percentiles", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			percentilesAgg := sr.Aggs[0].Aggregation.Aggs[0]
			require.Equal(t, percentilesAgg.Key, "1")
			require.Equal(t, percentilesAgg.Aggregation.Type, "percentiles")
			metricAgg := percentilesAgg.Aggregation.Aggregation.(*es.MetricAggregation)
			require.Equal(t, metricAgg.Field, "@load_time")
			percents := metricAgg.Settings["percents"].([]interface{})
			require.Len(t, percents, 4)
			require.Equal(t, percents[0], "1")
			require.Equal(t, percents[1], "2")
			require.Equal(t, percents[2], "3")
			require.Equal(t, percents[3], "4")
		})

		t.Run("With filters aggs", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			filtersAgg := sr.Aggs[0]
			require.Equal(t, filtersAgg.Key, "2")
			require.Equal(t, filtersAgg.Aggregation.Type, "filters")
			fAgg := filtersAgg.Aggregation.Aggregation.(*es.FiltersAggregation)
			require.Equal(t, fAgg.Filters["@metric:cpu"].(*es.QueryStringFilter).Query, "@metric:cpu")
			require.Equal(t, fAgg.Filters["@metric:logins.count"].(*es.QueryStringFilter).Query, "@metric:logins.count")

			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggs[0]
			require.Equal(t, dateHistogramAgg.Key, "4")
			require.Equal(t, dateHistogramAgg.Aggregation.Aggregation.(*es.DateHistogramAgg).Field, "@timestamp")
		})

		t.Run("With filters aggs and empty label (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{
						"id": "2",
						"type": "filters",
						"settings": {
							"filters": [ { "query": "@metric:cpu", "label": "" }, { "query": "@metric:logins.count", "label": "" } ]
						}
					},
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			filtersAgg := sr.Aggs[0]
			require.Equal(t, filtersAgg.Key, "2")
			require.Equal(t, filtersAgg.Aggregation.Type, "filters")
			fAgg := filtersAgg.Aggregation.Aggregation.(*es.FiltersAggregation)
			require.Equal(t, fAgg.Filters["@metric:cpu"].(*es.QueryStringFilter).Query, "@metric:cpu")
			require.Equal(t, fAgg.Filters["@metric:logins.count"].(*es.QueryStringFilter).Query, "@metric:logins.count")

			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggs[0]
			require.Equal(t, dateHistogramAgg.Key, "4")
			require.Equal(t, dateHistogramAgg.Aggregation.Aggregation.(*es.DateHistogramAgg).Field, "@timestamp")
		})

		t.Run("With raw document metric size", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_document", "settings": {}	}]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			require.Equal(t, sr.Size, defaultSize)
		})

		t.Run("With raw document metric query (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_document", "settings": {}	}]
			}`, from, to)
			require.NoError(t, err)

			sr := c.multisearchRequests[0].Requests[0]
			rangeFilter := sr.Query.Bool.Filters[0].(*es.RangeFilter)
			require.Equal(t, rangeFilter.Key, c.configuredFields.TimeField)
			require.Equal(t, rangeFilter.Lte, toMs)
			require.Equal(t, rangeFilter.Gte, fromMs)
			require.Equal(t, rangeFilter.Format, es.DateFormatEpochMS)

			require.Equal(t, sr.Size, defaultSize)
			require.Equal(t, sr.Sort["@timestamp"], map[string]string{"order": "desc", "unmapped_type": "boolean"})
			require.Equal(t, sr.Sort["_doc"], map[string]string{"order": "desc"})
			require.Equal(t, sr.CustomProps["script_fields"], map[string]interface{}{})
		})

		t.Run("With raw data metric query (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_data", "settings": {}	}]
			}`, from, to)
			require.NoError(t, err)

			sr := c.multisearchRequests[0].Requests[0]
			rangeFilter := sr.Query.Bool.Filters[0].(*es.RangeFilter)
			require.Equal(t, rangeFilter.Key, c.configuredFields.TimeField)
			require.Equal(t, rangeFilter.Lte, toMs)
			require.Equal(t, rangeFilter.Gte, fromMs)
			require.Equal(t, rangeFilter.Format, es.DateFormatEpochMS)

			require.Equal(t, sr.Size, defaultSize)
			require.Equal(t, sr.Sort["@timestamp"], map[string]string{"order": "desc", "unmapped_type": "boolean"})
			require.Equal(t, sr.Sort["_doc"], map[string]string{"order": "desc"})
			require.Equal(t, sr.CustomProps["script_fields"], map[string]interface{}{})
		})

		t.Run("With raw document metric size set", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_document", "settings": { "size": "1337" }	}]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			require.Equal(t, sr.Size, 1337)
		})

		t.Run("With date histogram agg", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{
						"id": "2",
						"type": "date_histogram",
						"field": "@timestamp",
						"settings": { "interval": "auto", "min_doc_count": 2 }
					}
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "2")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")
			hAgg := firstLevel.Aggregation.Aggregation.(*es.DateHistogramAgg)
			require.Equal(t, hAgg.Field, "@timestamp")
			require.Equal(t, hAgg.FixedInterval, "$__interval_msms")
			require.Equal(t, hAgg.MinDocCount, 2)

			t.Run("Should not include time_zone if not present in the query model (from frontend tests)", func(t *testing.T) {
				c := newFakeClient()
				_, err := executeElasticsearchDataQuery(c, `{
					"bucketAggs": [
						{
							"id": "2",
							"type": "date_histogram",
							"field": "@timestamp",
							"settings": {
								"min_doc_count": "1"
							}
						}
					],
					"metrics": [{"type": "count", "id": "1" }]
				}`, from, to)
				require.NoError(t, err)
				sr := c.multisearchRequests[0].Requests[0]

				dateHistogram := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)
				require.Empty(t, dateHistogram.TimeZone)
			})

			t.Run("Should not include time_zone when timeZone is utc", func(t *testing.T) {
				c := newFakeClient()
				_, err := executeElasticsearchDataQuery(c, `{
					"bucketAggs": [
						{
							"id": "2",
							"type": "date_histogram",
							"field": "@timestamp",
							"settings": {
								"timeZone": "utc"
							}
						}
					],
					"metrics": [{"type": "count", "id": "1" }]
				}`, from, to)
				require.NoError(t, err)
				sr := c.multisearchRequests[0].Requests[0]

				dateHistogram := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)
				require.Empty(t, dateHistogram.TimeZone)
			})

			t.Run("Should include time_zone when timeZone is not utc", func(t *testing.T) {
				c := newFakeClient()
				_, err := executeElasticsearchDataQuery(c, `{
					"bucketAggs": [
						{
							"id": "2",
							"type": "date_histogram",
							"field": "@timestamp",
							"settings": {
								"timeZone": "America/Los_Angeles"
							}
						}
					],
					"metrics": [{"type": "count", "id": "1" }]
				}`, from, to)
				require.NoError(t, err)
				sr := c.multisearchRequests[0].Requests[0]

				dateHistogram := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)
				require.Equal(t, dateHistogram.TimeZone, "America/Los_Angeles")
			})
		})

		t.Run("With histogram agg", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{
						"id": "3",
						"type": "histogram",
						"field": "bytes",
						"settings": { "interval": 10, "min_doc_count": 2, "missing": 5 }
					}
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "3")
			require.Equal(t, firstLevel.Aggregation.Type, "histogram")
			hAgg := firstLevel.Aggregation.Aggregation.(*es.HistogramAgg)
			require.Equal(t, hAgg.Field, "bytes")
			require.Equal(t, hAgg.Interval, 10)
			require.Equal(t, hAgg.MinDocCount, 2)
			require.Equal(t, *hAgg.Missing, 5)
		})

		t.Run("With histogram (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{
						"id": "3",
						"type": "histogram",
						"field": "bytes",
						"settings": { "interval": 10, "min_doc_count": 2 }
					}
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "3")
			require.Equal(t, firstLevel.Aggregation.Type, "histogram")
			hAgg := firstLevel.Aggregation.Aggregation.(*es.HistogramAgg)
			require.Equal(t, hAgg.Field, "bytes")
			require.Equal(t, hAgg.Interval, 10)
			require.Equal(t, hAgg.MinDocCount, 2)
		})

		t.Run("With geo hash grid agg", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{
						"id": "3",
						"type": "geohash_grid",
						"field": "@location",
						"settings": { "precision": 3 }
					}
				],
				"metrics": [{"type": "count", "id": "1" }]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "3")
			require.Equal(t, firstLevel.Aggregation.Type, "geohash_grid")
			ghGridAgg := firstLevel.Aggregation.Aggregation.(*es.GeoHashGridAggregation)
			require.Equal(t, ghGridAgg.Field, "@location")
			require.Equal(t, ghGridAgg.Precision, 3)
		})

		t.Run("With moving average (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "moving_avg",
						"field": "3"
					}
				]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "4")
			require.Equal(t, len(firstLevel.Aggregation.Aggs), 2)

			sumAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, sumAgg.Key, "3")
			require.Equal(t, sumAgg.Aggregation.Type, "sum")
			mAgg := sumAgg.Aggregation.Aggregation.(*es.MetricAggregation)
			require.Equal(t, mAgg.Field, "@value")

			movingAvgAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, movingAvgAgg.Key, "2")
			require.Equal(t, movingAvgAgg.Aggregation.Type, "moving_avg")
			pl := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, pl.BucketPath, "3")
		})

		t.Run("With moving average", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "4")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")
			require.Len(t, firstLevel.Aggregation.Aggs, 2)

			sumAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, sumAgg.Key, "3")
			require.Equal(t, sumAgg.Aggregation.Type, "sum")
			mAgg := sumAgg.Aggregation.Aggregation.(*es.MetricAggregation)
			require.Equal(t, mAgg.Field, "@value")

			movingAvgAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, movingAvgAgg.Key, "2")
			require.Equal(t, movingAvgAgg.Aggregation.Type, "moving_avg")
			pl := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, pl.BucketPath, "3")
		})

		t.Run("With moving average doc count (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "count"},
					{
						"id": "2",
						"type": "moving_avg",
						"field": "3"
					}
				]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "4")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")
			require.Len(t, firstLevel.Aggregation.Aggs, 1)

			movingAvgAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, movingAvgAgg.Key, "2")
			require.Equal(t, movingAvgAgg.Aggregation.Type, "moving_avg")
			pl := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, pl.BucketPath, "_count")
		})

		t.Run("With moving average doc count", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "4")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")
			require.Len(t, firstLevel.Aggregation.Aggs, 1)

			movingAvgAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, movingAvgAgg.Key, "2")
			require.Equal(t, movingAvgAgg.Aggregation.Type, "moving_avg")
			pl := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, pl.BucketPath, "_count")
		})

		t.Run("With broken moving average (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "moving_avg",
						"field": "3"
					},
					{
						"id": "4",
						"type": "moving_avg"
					}
				]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "3")
			require.Len(t, firstLevel.Aggregation.Aggs, 2)

			sumAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, sumAgg.Key, "3")

			movingAvgAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, movingAvgAgg.Key, "2")
			plAgg := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, plAgg.BucketPath, "3")
		})

		t.Run("With broken moving average", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "5")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")

			require.Len(t, firstLevel.Aggregation.Aggs, 2)

			movingAvgAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, movingAvgAgg.Key, "2")
			plAgg := movingAvgAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, plAgg.BucketPath, "3")
		})

		t.Run("With top_metrics (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
					{ "id": "2", "type": "top_metrics", "settings": { "order": "desc", "orderBy": "@timestamp", "metrics": ["@value"]} }
				]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "3")

			secondLevel := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, secondLevel.Key, "2")
			require.Equal(t, secondLevel.Aggregation.Type, "top_metrics")

			topMetricsBytes, _ := json.Marshal(firstLevel.Aggregation.Aggs[0].Aggregation.Aggregation)
			require.Equal(t, string(topMetricsBytes), `{"metrics":[{"field":"@value"}],"size":"1","sort":[{"@timestamp":"desc"}]}`)
		})

		t.Run("With cumulative sum", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "4")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")
			require.Len(t, firstLevel.Aggregation.Aggs, 2)

			sumAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, sumAgg.Key, "3")
			require.Equal(t, sumAgg.Aggregation.Type, "sum")
			mAgg := sumAgg.Aggregation.Aggregation.(*es.MetricAggregation)
			require.Equal(t, mAgg.Field, "@value")

			cumulativeSumAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, cumulativeSumAgg.Key, "2")
			require.Equal(t, cumulativeSumAgg.Aggregation.Type, "cumulative_sum")
			pl := cumulativeSumAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, pl.BucketPath, "3")
		})

		t.Run("With cumulative sum doc count", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "4")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")
			require.Len(t, firstLevel.Aggregation.Aggs, 1)

			cumulativeSumAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, cumulativeSumAgg.Key, "2")
			require.Equal(t, cumulativeSumAgg.Aggregation.Type, "cumulative_sum")
			pl := cumulativeSumAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, pl.BucketPath, "_count")
		})

		t.Run("With broken cumulative sum", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "5")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")

			require.Len(t, firstLevel.Aggregation.Aggs, 2)

			cumulativeSumAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, cumulativeSumAgg.Key, "2")
			plAgg := cumulativeSumAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, plAgg.BucketPath, "3")
		})

		t.Run("With derivative", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "4")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")

			derivativeAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, derivativeAgg.Key, "2")
			plAgg := derivativeAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, plAgg.BucketPath, "3")
		})

		t.Run("With derivative doc count", func(t *testing.T) {
			// This test is with pipelineAgg and is passing. Same test without pipelineAgg is failing.
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "4")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")

			derivativeAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, derivativeAgg.Key, "2")
			plAgg := derivativeAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, plAgg.BucketPath, "_count")
		})

		t.Run("With derivative doc count (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "count" },
					{
						"id": "2",
						"type": "derivative",
						"field": "3"
					}
				]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "4")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")

			derivativeAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, derivativeAgg.Key, "2")
			plAgg := derivativeAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, plAgg.BucketPath, "_count")
		})

		t.Run("With serial_diff", func(t *testing.T) {
			// This test is with pipelineAgg and is passing. Same test without pipelineAgg is failing.
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
				],
				"metrics": [
					{ "id": "3", "type": "sum", "field": "@value" },
					{
						"id": "2",
						"type": "serial_diff",
						"pipelineAgg": "3",
						"settings": { "lag": "5" }
					}
				]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "4")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")

			serialDiffAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, serialDiffAgg.Key, "2")
			plAgg := serialDiffAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, plAgg.BucketPath, "3")
			require.Equal(t, plAgg.Settings["lag"], 5.)
		})

		t.Run("With serial_diff (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
				],
				"metrics": [
					{ "id": "3", "type": "max", "field": "@value" },
					{
						"id": "2",
						"type": "serial_diff",
						"field": "3",
						"settings": { "lag": "5" }
					}
				]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "3")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")
			serialDiffAgg := firstLevel.Aggregation.Aggs[1]
			require.Equal(t, serialDiffAgg.Key, "2")
			plAgg := serialDiffAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, plAgg.BucketPath, "3")
			require.Equal(t, plAgg.Settings["lag"], 5.0)
		})

		t.Run("With serial_diff doc count", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "4")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")

			serialDiffAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, serialDiffAgg.Key, "2")
			plAgg := serialDiffAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, plAgg.BucketPath, "_count")
		})

		t.Run("With bucket_script", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "2" }
				],
				"metrics": [
					{ "id": "1", "type": "sum", "field": "@value" },
					{ "id": "3", "type": "max", "field": "@value" },
					{
						"id": "4",
						"type": "bucket_script",
						"pipelineVariables": [
							{ "name": "var1", "pipelineAgg": "1" },
							{ "name": "var2", "pipelineAgg": "3" }
						],
						"settings": { "script": "params.var1 * params.var2" }
					}
				]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "2")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")

			bucketScriptAgg := firstLevel.Aggregation.Aggs[2]
			require.Equal(t, bucketScriptAgg.Key, "4")
			plAgg := bucketScriptAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, plAgg.BucketPath.(map[string]interface{}), map[string]interface{}{
				"var1": "1",
				"var2": "3",
			})
		})

		t.Run("With bucket_script (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "4")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")

			bucketScriptAgg := firstLevel.Aggregation.Aggs[2]
			require.Equal(t, bucketScriptAgg.Key, "2")
			plAgg := bucketScriptAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, plAgg.BucketPath.(map[string]interface{}), map[string]interface{}{
				"var1": "3",
				"var2": "5",
			})
		})

		t.Run("With bucket_script doc count", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "4")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")

			bucketScriptAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, bucketScriptAgg.Key, "2")
			plAgg := bucketScriptAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, plAgg.BucketPath.(map[string]interface{}), map[string]interface{}{
				"var1": "_count",
			})
		})

		t.Run("With bucket_script doc count (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"bucketAggs": [
					{ "type": "date_histogram", "field": "@timestamp", "id": "2" }
				],
				"metrics": [
					{ "id": "3", "type": "count"},
					{
						"id": "4",
						"type": "bucket_script",
						"pipelineVariables": [
							{ "name": "var1", "pipelineAgg": "3" }
						],
						"settings": { "script": "params.var1 * 1000" }
					}
				]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "2")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")

			bucketScriptAgg := firstLevel.Aggregation.Aggs[0]
			require.Equal(t, bucketScriptAgg.Key, "4")
			plAgg := bucketScriptAgg.Aggregation.Aggregation.(*es.PipelineAggregation)
			require.Equal(t, plAgg.BucketPath.(map[string]interface{}), map[string]interface{}{
				"var1": "_count",
			})
		})

		t.Run("With lucene query should add query_string filter when query is not empty (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"query": "foo",
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_data", "settings": {}	}]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			filter := sr.Query.Bool.Filters[1].(*es.QueryStringFilter)
			require.Equal(t, filter.Query, "foo")
			require.Equal(t, filter.AnalyzeWildcard, true)
		})

		t.Run("With lucene query should add query_string filter when query is not empty (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"query": "foo",
				"bucketAggs": [],
				"metrics": [{ "id": "1", "type": "raw_data", "settings": {}	}]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			filter := sr.Query.Bool.Filters[1].(*es.QueryStringFilter)
			require.Equal(t, filter.Query, "foo")
			require.Equal(t, filter.AnalyzeWildcard, true)
		})

		t.Run("With log query should return query with defaults (from frontend tests)", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"metrics": [{ "type": "logs", "id": "1"}]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			require.Equal(t, sr.Size, defaultSize)

			rangeFilter := sr.Query.Bool.Filters[0].(*es.RangeFilter)
			require.Equal(t, rangeFilter.Key, c.configuredFields.TimeField)
			require.Equal(t, rangeFilter.Lte, toMs)
			require.Equal(t, rangeFilter.Gte, fromMs)
			require.Equal(t, rangeFilter.Format, es.DateFormatEpochMS)

			require.Equal(t, sr.Sort["@timestamp"], map[string]string{"order": "desc", "unmapped_type": "boolean"})
			require.Equal(t, sr.Sort["_doc"], map[string]string{"order": "desc"})
			require.Equal(t, sr.CustomProps["script_fields"], map[string]interface{}{})

			firstLevel := sr.Aggs[0]
			require.Equal(t, firstLevel.Key, "1")
			require.Equal(t, firstLevel.Aggregation.Type, "date_histogram")

			hAgg := firstLevel.Aggregation.Aggregation.(*es.DateHistogramAgg)
			require.Equal(t, hAgg.ExtendedBounds.Max, toMs)
			require.Equal(t, hAgg.ExtendedBounds.Min, fromMs)
			require.Equal(t, hAgg.Field, "@timestamp")
			require.Equal(t, hAgg.Format, es.DateFormatEpochMS)
			require.Equal(t, hAgg.FixedInterval, "$__interval_msms")
			require.Equal(t, hAgg.MinDocCount, 0)
		})

		t.Run("With log query with limit should return query with correct size", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"metrics": [{ "type": "logs", "id": "1", "settings": { "limit": "1000" }}]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			require.Equal(t, sr.Size, 1000)
		})

		t.Run("With log query should return highlight properties", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"metrics": [{ "type": "logs", "id": "1" }]
			}`, from, to)
			require.NoError(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			require.Equal(t, sr.CustomProps["highlight"], map[string]interface{}{
				"fields": map[string]interface{}{
					"*": map[string]interface{}{},
				},
				"fragment_size": 2147483647,
				"post_tags":     []string{"@/HIGHLIGHT@"},
				"pre_tags":      []string{"@HIGHLIGHT@"},
			})
		})

		t.Run("With invalid query should return error", (func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"query": "foo",
			}`, from, to)
			require.Error(t, err)
		}))
	})
}

func TestSettingsCasting(t *testing.T) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)

	t.Run("Correctly casts values in moving_avg (from frontend tests)", func(t *testing.T) {
		c := newFakeClient()
		_, err := executeElasticsearchDataQuery(c, `{
				"metrics": [
					{ "type": "avg", "id" : "2" },
					{
						"type": "moving_avg",
						"id" : "3",
						"pipelineAgg": "2",
						"settings": {
							"window": "5",
							"model": "holt_winters",
							"predict": "10",
							"settings": {
								"alpha": "1",
								"beta": "2",
								"gamma": "3",
								"period": "4"
							}
						} 
					}
				],
				"bucketAggs": [{"type": "date_histogram", "field": "@timestamp", "id": "1"}]
			}`, from, to)
		require.NoError(t, err)
		sr := c.multisearchRequests[0].Requests[0]
		movingAvgSettings := sr.Aggs[0].Aggregation.Aggs[1].Aggregation.Aggregation.(*es.PipelineAggregation).Settings

		assert.Equal(t, movingAvgSettings["window"], 5.0)
		assert.Equal(t, movingAvgSettings["predict"], 10.0)

		modelSettings := movingAvgSettings["settings"].(map[string]interface{})

		assert.Equal(t, modelSettings["alpha"], 1.0)
		assert.Equal(t, modelSettings["beta"], 2.0)
		assert.Equal(t, modelSettings["gamma"], 3.0)
		assert.Equal(t, modelSettings["period"], 4.0)
	})

	t.Run("Correctly transforms moving_average settings", func(t *testing.T) {
		// This test is with pipelineAgg and is passing. Same test without pipelineAgg is failing.
		c := newFakeClient()
		_, err := executeElasticsearchDataQuery(c, `{
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
		}`, from, to)
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

	t.Run("Correctly transforms serial_diff settings (from frontend tests)", func(t *testing.T) {
		c := newFakeClient()
		_, err := executeElasticsearchDataQuery(c, `{
			"bucketAggs": [
				{ "type": "date_histogram", "field": "@timestamp", "id": "1" }
			],
			"metrics": [
				{ "id": "2", "type": "avg" },
				{
					"id": "3",
					"type": "serial_diff",
					"field": "2",
					"settings": {
						"lag": "1"
					}
				}
			]
		}`, from, to)
		assert.Nil(t, err)
		sr := c.multisearchRequests[0].Requests[0]
		serialDiffSettings := sr.Aggs[0].Aggregation.Aggs[1].Aggregation.Aggregation.(*es.PipelineAggregation).Settings
		assert.Equal(t, serialDiffSettings["lag"], 1.)
	})

	t.Run("Correctly transforms serial_diff settings", func(t *testing.T) {
		// This test is with pipelineAgg and is passing. Same test without pipelineAgg is failing.
		c := newFakeClient()
		_, err := executeElasticsearchDataQuery(c, `{
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
		}`, from, to)
		assert.Nil(t, err)
		sr := c.multisearchRequests[0].Requests[0]

		serialDiffSettings := sr.Aggs[0].Aggregation.Aggs[1].Aggregation.Aggregation.(*es.PipelineAggregation).Settings

		assert.Equal(t, 1., serialDiffSettings["lag"])
	})

	t.Run("Date Histogram Settings", func(t *testing.T) {
		t.Run("Correctly transforms date_histogram settings", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			assert.Nil(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)

			assert.Equal(t, 1, dateHistogramAgg.MinDocCount)
		})

		t.Run("Correctly uses already int min_doc_count", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)
			assert.Nil(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)

			assert.Equal(t, 10, dateHistogramAgg.MinDocCount)
		})

		t.Run("interval parameter", func(t *testing.T) {
			t.Run("Uses fixed_interval", func(t *testing.T) {
				c := newFakeClient()
				_, err := executeElasticsearchDataQuery(c, `{
					"bucketAggs": [
						{
							"type": "date_histogram",
							"field": "@timestamp",
							"id": "2",
							"settings": {
								"interval": "1d"
							}
						}
					],
					"metrics": [
						{ "id": "1", "type": "average", "field": "@value" }
					]
				}`, from, to)
				assert.Nil(t, err)
				sr := c.multisearchRequests[0].Requests[0]

				dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)

				assert.NotZero(t, dateHistogramAgg.FixedInterval)
			})
		})
	})

	t.Run("Inline Script", func(t *testing.T) {
		t.Run("Correctly handles scripts", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
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
			}`, from, to)

			assert.Nil(t, err)
			sr := c.multisearchRequests[0].Requests[0]

			newFormatAggSettings := sr.Aggs[0].Aggregation.Aggs[0].Aggregation.Aggregation.(*es.MetricAggregation).Settings
			oldFormatAggSettings := sr.Aggs[0].Aggregation.Aggs[1].Aggregation.Aggregation.(*es.MetricAggregation).Settings

			assert.Equal(t, "my_script", newFormatAggSettings["script"])
			assert.Equal(t, "my_script", oldFormatAggSettings["script"])
		})
	})

	t.Run("Field property (from frontend tests)", func(t *testing.T) {
		t.Run("Should use timeField from datasource when not specified", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"metrics": [{ "type": "count", "id": "1" }],
				"bucketAggs": [
					{ "type": "date_histogram", "id": "2", "settings": { "min_doc_count": "1" } }
				]
			}`, from, to)

			assert.Nil(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)
			assert.Equal(t, dateHistogramAgg.Field, "@timestamp")
		})

		t.Run("Should use field from bucket agg when specified", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"metrics": [{ "type": "count", "id": "1" }],
				"bucketAggs": [
					{ "type": "date_histogram", "id": "2", "field": "@time", "settings": { "min_doc_count": "1" } }
				]
			}`, from, to)

			assert.Nil(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)
			assert.Equal(t, dateHistogramAgg.Field, "@time")
		})

		t.Run("Should use fixed_interval", func(t *testing.T) {
			c := newFakeClient()
			_, err := executeElasticsearchDataQuery(c, `{
				"metrics": [{ "type": "count", "id": "1" }],
				"bucketAggs": [
					{ "type": "date_histogram", "id": "2", "field": "@time", "settings": { "min_doc_count": "1", "interval": "1d" } }
				]
			}`, from, to)

			assert.Nil(t, err)
			sr := c.multisearchRequests[0].Requests[0]
			dateHistogramAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.DateHistogramAgg)
			assert.Equal(t, dateHistogramAgg.FixedInterval, "1d")
		})
	})
}

type fakeClient struct {
	configuredFields    es.ConfiguredFields
	multiSearchResponse *es.MultiSearchResponse
	multiSearchError    error
	builder             *es.MultiSearchRequestBuilder
	multisearchRequests []*es.MultiSearchRequest
}

func newFakeClient() *fakeClient {
	configuredFields := es.ConfiguredFields{
		TimeField:       "@timestamp",
		LogMessageField: "line",
		LogLevelField:   "lvl",
	}

	return &fakeClient{
		configuredFields:    configuredFields,
		multisearchRequests: make([]*es.MultiSearchRequest, 0),
		multiSearchResponse: &es.MultiSearchResponse{},
	}
}

func (c *fakeClient) GetConfiguredFields() es.ConfiguredFields {
	return c.configuredFields
}

func (c *fakeClient) GetMinInterval(queryInterval string) (time.Duration, error) {
	return 15 * time.Second, nil
}

func (c *fakeClient) ExecuteMultisearch(r *es.MultiSearchRequest) (*es.MultiSearchResponse, error) {
	c.multisearchRequests = append(c.multisearchRequests, r)
	return c.multiSearchResponse, c.multiSearchError
}

func (c *fakeClient) MultiSearch() *es.MultiSearchRequestBuilder {
	c.builder = es.NewMultiSearchRequestBuilder()
	return c.builder
}

func newDataQuery(body string) (backend.QueryDataRequest, error) {
	return backend.QueryDataRequest{
		Queries: []backend.DataQuery{
			{
				JSON:     json.RawMessage(body),
				Interval: 10 * time.Second,
			},
		},
	}, nil
}

func executeElasticsearchDataQuery(c es.Client, body string, from, to time.Time) (
	*backend.QueryDataResponse, error) {
	timeRange := backend.TimeRange{
		From: from,
		To:   to,
	}
	dataRequest := backend.QueryDataRequest{
		Queries: []backend.DataQuery{
			{
				JSON:      json.RawMessage(body),
				TimeRange: timeRange,
			},
		},
	}
	query := newElasticsearchDataQuery(c, dataRequest.Queries)
	return query.execute()
}
