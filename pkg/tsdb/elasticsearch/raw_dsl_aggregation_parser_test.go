package elasticsearch

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestFieldExtractor tests the field extraction utility
func TestFieldExtractor(t *testing.T) {
	extractor := &fieldExtractor{}

	t.Run("getString", func(t *testing.T) {
		data := map[string]any{
			"field":   "value",
			"number":  42,
			"missing": nil,
		}

		assert.Equal(t, "value", extractor.getString(data, "field"))
		assert.Equal(t, "", extractor.getString(data, "number"))
		assert.Equal(t, "", extractor.getString(data, "missing"))
		assert.Equal(t, "", extractor.getString(data, "nonexistent"))
	})

	t.Run("getInt", func(t *testing.T) {
		data := map[string]any{
			"float":  42.0,
			"int":    100,
			"string": "200",
			"bad":    "notanumber",
		}

		assert.Equal(t, 42, extractor.getInt(data, "float"))
		assert.Equal(t, 100, extractor.getInt(data, "int"))
		assert.Equal(t, 200, extractor.getInt(data, "string"))
		assert.Equal(t, 0, extractor.getInt(data, "bad"))
		assert.Equal(t, 0, extractor.getInt(data, "nonexistent"))
	})

	t.Run("getFloat", func(t *testing.T) {
		data := map[string]any{
			"float":  42.5,
			"int":    100,
			"string": "3.14",
		}

		assert.Equal(t, 42.5, extractor.getFloat(data, "float"))
		assert.Equal(t, 100.0, extractor.getFloat(data, "int"))
		assert.Equal(t, 3.14, extractor.getFloat(data, "string"))
		assert.Equal(t, 0.0, extractor.getFloat(data, "nonexistent"))
	})

	t.Run("getMap", func(t *testing.T) {
		data := map[string]any{
			"map":    map[string]any{"key": "value"},
			"notmap": "string",
		}

		result := extractor.getMap(data, "map")
		require.NotNil(t, result)
		assert.Equal(t, "value", result["key"])

		assert.Nil(t, extractor.getMap(data, "notmap"))
		assert.Nil(t, extractor.getMap(data, "nonexistent"))
	})
}

// TestDateHistogramParser tests the date histogram parser
func TestDateHistogramParser(t *testing.T) {
	parser := &dateHistogramParser{extractor: &fieldExtractor{}}

	t.Run("CanParse", func(t *testing.T) {
		assert.True(t, parser.CanParse(dateHistType))
		assert.False(t, parser.CanParse("terms"))
	})

	t.Run("ParseBucket with fixed_interval", func(t *testing.T) {
		aggValue := map[string]any{
			"field":          "@timestamp",
			"fixed_interval": "30s",
			"min_doc_count":  1,
		}

		bucket, err := parser.ParseBucket("1", dateHistType, aggValue)
		require.NoError(t, err)
		require.NotNil(t, bucket)

		assert.Equal(t, "1", bucket.ID)
		assert.Equal(t, dateHistType, bucket.Type)
		assert.Equal(t, "@timestamp", bucket.Field)
		assert.Equal(t, "30s", bucket.Settings.Get("interval").MustString())
		assert.Equal(t, "1", bucket.Settings.Get("min_doc_count").MustString())
	})

	t.Run("ParseBucket with calendar_interval", func(t *testing.T) {
		aggValue := map[string]any{
			"field":             "@timestamp",
			"calendar_interval": "1d",
			"time_zone":         "UTC",
		}

		bucket, err := parser.ParseBucket("2", dateHistType, aggValue)
		require.NoError(t, err)
		require.NotNil(t, bucket)

		assert.Equal(t, "1d", bucket.Settings.Get("interval").MustString())
		assert.Equal(t, "UTC", bucket.Settings.Get("time_zone").MustString())
	})

	t.Run("ParseMetric returns nil", func(t *testing.T) {
		metric, err := parser.ParseMetric("1", dateHistType, map[string]any{})
		assert.NoError(t, err)
		assert.Nil(t, metric)
	})
}

// TestTermsParser tests the terms parser
func TestTermsParser(t *testing.T) {
	parser := &termsParser{extractor: &fieldExtractor{}}

	t.Run("CanParse", func(t *testing.T) {
		assert.True(t, parser.CanParse(termsType))
		assert.False(t, parser.CanParse("histogram"))
	})

	t.Run("ParseBucket", func(t *testing.T) {
		aggValue := map[string]any{
			"field": "hostname.keyword",
			"size":  10,
			"order": map[string]any{"_count": "desc"},
		}

		bucket, err := parser.ParseBucket("3", termsType, aggValue)
		require.NoError(t, err)
		require.NotNil(t, bucket)

		assert.Equal(t, "3", bucket.ID)
		assert.Equal(t, termsType, bucket.Type)
		assert.Equal(t, "hostname.keyword", bucket.Field)
		assert.Equal(t, "10", bucket.Settings.Get("size").MustString())
	})
}

// TestHistogramParser tests the histogram parser
func TestHistogramParser(t *testing.T) {
	parser := &histogramParser{extractor: &fieldExtractor{}}

	t.Run("CanParse", func(t *testing.T) {
		assert.True(t, parser.CanParse(histogramType))
		assert.False(t, parser.CanParse("terms"))
	})

	t.Run("ParseBucket", func(t *testing.T) {
		aggValue := map[string]any{
			"field":    "response_time",
			"interval": 50.0,
		}

		bucket, err := parser.ParseBucket("4", histogramType, aggValue)
		require.NoError(t, err)
		require.NotNil(t, bucket)

		assert.Equal(t, "4", bucket.ID)
		assert.Equal(t, histogramType, bucket.Type)
		assert.Equal(t, "response_time", bucket.Field)
		assert.Equal(t, "50", bucket.Settings.Get("interval").MustString())
	})
}

// TestFiltersParser tests the filters parser
func TestFiltersParser(t *testing.T) {
	parser := &filtersParser{extractor: &fieldExtractor{}}

	t.Run("CanParse", func(t *testing.T) {
		assert.True(t, parser.CanParse(filtersType))
		assert.False(t, parser.CanParse("terms"))
	})

	t.Run("ParseBucket", func(t *testing.T) {
		aggValue := map[string]any{
			"filters": map[string]any{
				"errors":   map[string]any{"query_string": map[string]any{"query": "level:error"}},
				"warnings": map[string]any{"query_string": map[string]any{"query": "level:warning"}},
			},
		}

		bucket, err := parser.ParseBucket("filters", filtersType, aggValue)
		require.NoError(t, err)
		require.NotNil(t, bucket)

		assert.Equal(t, "filters", bucket.ID)
		assert.Equal(t, filtersType, bucket.Type)
		assert.NotEmpty(t, bucket.Settings.Get("filters").MustString())
	})
}

// TestSimpleMetricParser tests the simple metric parser
func TestSimpleMetricParser(t *testing.T) {
	parser := newSimpleMetricParser()

	t.Run("CanParse", func(t *testing.T) {
		assert.True(t, parser.CanParse("avg"))
		assert.True(t, parser.CanParse("sum"))
		assert.True(t, parser.CanParse("min"))
		assert.True(t, parser.CanParse("max"))
		assert.True(t, parser.CanParse("cardinality"))
		assert.False(t, parser.CanParse("bucket_script"))
	})

	t.Run("ParseMetric avg", func(t *testing.T) {
		aggValue := map[string]any{
			"field": "response_time",
		}

		metric, err := parser.ParseMetric("1", "avg", aggValue)
		require.NoError(t, err)
		require.NotNil(t, metric)

		assert.Equal(t, "1", metric.ID)
		assert.Equal(t, "avg", metric.Type)
		assert.Equal(t, "response_time", metric.Field)
	})

	t.Run("ParseBucket returns nil", func(t *testing.T) {
		bucket, err := parser.ParseBucket("1", "avg", map[string]any{})
		assert.NoError(t, err)
		assert.Nil(t, bucket)
	})
}

// TestExtendedStatsParser tests the extended stats parser
func TestExtendedStatsParser(t *testing.T) {
	parser := &extendedStatsParser{extractor: &fieldExtractor{}}

	t.Run("CanParse", func(t *testing.T) {
		assert.True(t, parser.CanParse(extendedStatsType))
		assert.False(t, parser.CanParse("avg"))
	})

	t.Run("ParseMetric", func(t *testing.T) {
		aggValue := map[string]any{
			"field": "response_time",
			"sigma": 2,
		}

		metric, err := parser.ParseMetric("stats", extendedStatsType, aggValue)
		require.NoError(t, err)
		require.NotNil(t, metric)

		assert.Equal(t, "stats", metric.ID)
		assert.Equal(t, extendedStatsType, metric.Type)
		assert.Equal(t, "response_time", metric.Field)
	})
}

// TestPercentilesParser tests the percentiles parser
func TestPercentilesParser(t *testing.T) {
	parser := &percentilesParser{extractor: &fieldExtractor{}}

	t.Run("CanParse", func(t *testing.T) {
		assert.True(t, parser.CanParse(percentilesType))
		assert.False(t, parser.CanParse("avg"))
	})

	t.Run("ParseMetric", func(t *testing.T) {
		aggValue := map[string]any{
			"field":    "response_time",
			"percents": []any{50.0, 95.0, 99.0},
		}

		metric, err := parser.ParseMetric("percentiles", percentilesType, aggValue)
		require.NoError(t, err)
		require.NotNil(t, metric)

		assert.Equal(t, "percentiles", metric.ID)
		assert.Equal(t, percentilesType, metric.Type)
		assert.Equal(t, "response_time", metric.Field)
	})
}

// TestPipelineParser tests the pipeline parser
func TestPipelineParser(t *testing.T) {
	parser := newPipelineParser()

	t.Run("CanParse", func(t *testing.T) {
		assert.True(t, parser.CanParse("moving_avg"))
		assert.True(t, parser.CanParse("derivative"))
		assert.True(t, parser.CanParse("cumulative_sum"))
		assert.False(t, parser.CanParse("bucket_script"))
	})

	t.Run("ParseMetric", func(t *testing.T) {
		aggValue := map[string]any{
			"buckets_path": "1",
		}

		metric, err := parser.ParseMetric("moving", "moving_avg", aggValue)
		require.NoError(t, err)
		require.NotNil(t, metric)

		assert.Equal(t, "moving", metric.ID)
		assert.Equal(t, "moving_avg", metric.Type)
		assert.Equal(t, "1", metric.Field)
	})
}

// TestBucketScriptParser tests the bucket script parser
func TestBucketScriptParser(t *testing.T) {
	parser := &bucketScriptParser{extractor: &fieldExtractor{}}

	t.Run("CanParse", func(t *testing.T) {
		assert.True(t, parser.CanParse("bucket_script"))
		assert.False(t, parser.CanParse("moving_avg"))
	})

	t.Run("ParseMetric with map buckets_path", func(t *testing.T) {
		aggValue := map[string]any{
			"buckets_path": map[string]any{
				"count": "total",
			},
			"script": "params.count / 60",
		}

		metric, err := parser.ParseMetric("rate", "bucket_script", aggValue)
		require.NoError(t, err)
		require.NotNil(t, metric)

		assert.Equal(t, "rate", metric.ID)
		assert.Equal(t, "bucket_script", metric.Type)
		assert.Equal(t, "total", metric.PipelineVariables["count"])
		assert.Equal(t, "params.count / 60", metric.Settings.Get("script").MustString())
	})

	t.Run("ParseMetric with string buckets_path", func(t *testing.T) {
		aggValue := map[string]any{
			"buckets_path": "1",
		}

		metric, err := parser.ParseMetric("rate", "bucket_script", aggValue)
		require.NoError(t, err)
		require.NotNil(t, metric)

		assert.Equal(t, "1", metric.PipelineVariables["var1"])
	})
}

// TestCompositeParser tests the full parser integration
func TestCompositeParser(t *testing.T) {
	parser := NewAggregationParser()

	t.Run("Parse date histogram aggregation", func(t *testing.T) {
		rawQuery := `{
			"query": {
				"match_all": {}
			},
			"aggs": {
				"2": {
					"date_histogram": {
						"field": "@timestamp",
						"fixed_interval": "30s",
						"min_doc_count": 1
					}
				}
			}
		}`

		bucketAggs, metricAggs, err := parser.Parse(rawQuery)
		require.NoError(t, err)
		require.Len(t, bucketAggs, 1)
		require.Len(t, metricAggs, 0)

		assert.Equal(t, "2", bucketAggs[0].ID)
		assert.Equal(t, dateHistType, bucketAggs[0].Type)
		assert.Equal(t, "@timestamp", bucketAggs[0].Field)
		assert.Equal(t, "30s", bucketAggs[0].Settings.Get("interval").MustString())
	})

	t.Run("Parse nested aggregations with metrics", func(t *testing.T) {
		rawQuery := `{
			"query": {
				"match_all": {}
			},
			"aggs": {
				"2": {
					"date_histogram": {
						"field": "@timestamp",
						"fixed_interval": "30s"
					},
					"aggs": {
						"1": {
							"avg": {
								"field": "value"
							}
						},
						"3": {
							"sum": {
								"field": "total"
							}
						}
					}
				}
			}
		}`

		bucketAggs, metricAggs, err := parser.Parse(rawQuery)
		require.NoError(t, err)
		require.Len(t, bucketAggs, 1)
		require.Len(t, metricAggs, 2)

		// Check bucket aggregation
		assert.Equal(t, "2", bucketAggs[0].ID)
		assert.Equal(t, dateHistType, bucketAggs[0].Type)

		// Check metric aggregations
		avgFound := false
		sumFound := false
		for _, m := range metricAggs {
			if m.ID == "1" && m.Type == "avg" && m.Field == "value" {
				avgFound = true
			}
			if m.ID == "3" && m.Type == "sum" && m.Field == "total" {
				sumFound = true
			}
		}
		assert.True(t, avgFound, "avg aggregation not found")
		assert.True(t, sumFound, "sum aggregation not found")
	})

	t.Run("Parse terms aggregation", func(t *testing.T) {
		rawQuery := `{
			"aggs": {
				"3": {
					"terms": {
						"field": "hostname.keyword",
						"size": 10,
						"order": {
							"_count": "desc"
						}
					}
				}
			}
		}`

		bucketAggs, metricAggs, err := parser.Parse(rawQuery)
		require.NoError(t, err)
		require.Len(t, bucketAggs, 1)
		require.Len(t, metricAggs, 0)

		assert.Equal(t, "3", bucketAggs[0].ID)
		assert.Equal(t, termsType, bucketAggs[0].Type)
		assert.Equal(t, "hostname.keyword", bucketAggs[0].Field)
		assert.Equal(t, "10", bucketAggs[0].Settings.Get("size").MustString())
	})

	t.Run("Parse histogram aggregation", func(t *testing.T) {
		rawQuery := `{
			"aggs": {
				"4": {
					"histogram": {
						"field": "response_time",
						"interval": 50
					}
				}
			}
		}`

		bucketAggs, _, err := parser.Parse(rawQuery)
		require.NoError(t, err)
		require.Len(t, bucketAggs, 1)

		assert.Equal(t, "4", bucketAggs[0].ID)
		assert.Equal(t, histogramType, bucketAggs[0].Type)
		assert.Equal(t, "response_time", bucketAggs[0].Field)
		assert.Equal(t, "50", bucketAggs[0].Settings.Get("interval").MustString())
	})

	t.Run("Parse extended stats aggregation", func(t *testing.T) {
		rawQuery := `{
			"aggs": {
				"stats": {
					"extended_stats": {
						"field": "response_time",
						"sigma": 2
					}
				}
			}
		}`

		_, metricAggs, err := parser.Parse(rawQuery)
		require.NoError(t, err)
		require.Len(t, metricAggs, 1)

		assert.Equal(t, "stats", metricAggs[0].ID)
		assert.Equal(t, extendedStatsType, metricAggs[0].Type)
		assert.Equal(t, "response_time", metricAggs[0].Field)
	})

	t.Run("Parse percentiles aggregation", func(t *testing.T) {
		rawQuery := `{
			"aggs": {
				"percentiles": {
					"percentiles": {
						"field": "response_time",
						"percents": [50, 95, 99]
					}
				}
			}
		}`

		_, metricAggs, err := parser.Parse(rawQuery)
		require.NoError(t, err)
		require.Len(t, metricAggs, 1)

		assert.Equal(t, "percentiles", metricAggs[0].ID)
		assert.Equal(t, percentilesType, metricAggs[0].Type)
	})

	t.Run("Parse pipeline aggregations", func(t *testing.T) {
		rawQuery := `{
			"aggs": {
				"2": {
					"date_histogram": {
						"field": "@timestamp",
						"fixed_interval": "1m"
					},
					"aggs": {
						"1": {
							"avg": {
								"field": "value"
							}
						},
						"moving": {
							"moving_avg": {
								"buckets_path": "1"
							}
						},
						"deriv": {
							"derivative": {
								"buckets_path": "1"
							}
						}
					}
				}
			}
		}`

		bucketAggs, metricAggs, err := parser.Parse(rawQuery)
		require.NoError(t, err)
		require.Len(t, bucketAggs, 1)
		require.GreaterOrEqual(t, len(metricAggs), 2) // At least avg and one pipeline

		// Find pipeline aggregations
		movingAvgFound := false
		derivativeFound := false
		for _, m := range metricAggs {
			if m.ID == "moving" && m.Type == "moving_avg" {
				movingAvgFound = true
				assert.Equal(t, "1", m.Field)
			}
			if m.ID == "deriv" && m.Type == "derivative" {
				derivativeFound = true
				assert.Equal(t, "1", m.Field)
			}
		}
		assert.True(t, movingAvgFound, "moving_avg aggregation not found")
		assert.True(t, derivativeFound, "derivative aggregation not found")
	})

	t.Run("Parse bucket script aggregation", func(t *testing.T) {
		rawQuery := `{
			"aggs": {
				"2": {
					"date_histogram": {
						"field": "@timestamp",
						"fixed_interval": "1m"
					},
					"aggs": {
						"total": {
							"sum": {
								"field": "bytes"
							}
						},
						"rate": {
							"bucket_script": {
								"buckets_path": {
									"count": "total"
								},
								"script": "params.count / 60"
							}
						}
					}
				}
			}
		}`

		_, metricAggs, err := parser.Parse(rawQuery)
		require.NoError(t, err)

		// Find bucket script
		var bucketScriptAgg *MetricAgg
		for _, m := range metricAggs {
			if m.ID == "rate" && m.Type == "bucket_script" {
				bucketScriptAgg = m
				break
			}
		}
		require.NotNil(t, bucketScriptAgg, "bucket_script aggregation not found")
		assert.Equal(t, "params.count / 60", bucketScriptAgg.Settings.Get("script").MustString())
		assert.Equal(t, "total", bucketScriptAgg.PipelineVariables["count"])
	})

	t.Run("Parse filters aggregation", func(t *testing.T) {
		rawQuery := `{
			"aggs": {
				"messages": {
					"filters": {
						"filters": {
							"errors": {
								"query_string": {
									"query": "level:error"
								}
							},
							"warnings": {
								"query_string": {
									"query": "level:warning"
								}
							}
						}
					}
				}
			}
		}`

		bucketAggs, _, err := parser.Parse(rawQuery)
		require.NoError(t, err)
		require.Len(t, bucketAggs, 1)

		assert.Equal(t, "messages", bucketAggs[0].ID)
		assert.Equal(t, filtersType, bucketAggs[0].Type)
	})

	t.Run("Handle empty query", func(t *testing.T) {
		bucketAggs, metricAggs, err := parser.Parse("")
		require.NoError(t, err)
		assert.Nil(t, bucketAggs)
		assert.Nil(t, metricAggs)
	})

	t.Run("Handle query without aggregations", func(t *testing.T) {
		rawQuery := `{
			"query": {
				"match_all": {}
			}
		}`

		bucketAggs, metricAggs, err := parser.Parse(rawQuery)
		require.NoError(t, err)
		assert.Nil(t, bucketAggs)
		assert.Nil(t, metricAggs)
	})

	t.Run("Handle invalid JSON", func(t *testing.T) {
		rawQuery := `{invalid json`

		_, _, err := parser.Parse(rawQuery)
		require.Error(t, err)
	})

	t.Run("Use 'aggregations' instead of 'aggs'", func(t *testing.T) {
		rawQuery := `{
			"query": {
				"match_all": {}
			},
			"aggregations": {
				"2": {
					"date_histogram": {
						"field": "@timestamp",
						"fixed_interval": "30s"
					}
				}
			}
		}`

		bucketAggs, _, err := parser.Parse(rawQuery)
		require.NoError(t, err)
		require.Len(t, bucketAggs, 1)
		assert.Equal(t, "2", bucketAggs[0].ID)
	})
}
