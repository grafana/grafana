package elasticsearch

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

func parseQuery(tsdbQuery []backend.DataQuery, logger log.Logger) ([]*Query, error) {
	queries := make([]*Query, 0)
	for _, q := range tsdbQuery {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			return nil, err
		}

		// we had a string-field named `timeField` in the past. we do not use it anymore.
		// please do not create a new field with that name, to avoid potential problems with old, persisted queries.

		rawQuery := model.Get("query").MustString()
		bucketAggs, err := parseBucketAggs(model)
		if err != nil {
			logger.Error("Failed to parse bucket aggs in query", "error", err, "model", string(q.JSON))
			return nil, backend.DownstreamError(err)
		}
		metrics, err := parseMetrics(model)
		if err != nil {
			logger.Error("Failed to parse metrics in query", "error", err, "model", string(q.JSON))
			return nil, err
		}
		alias := model.Get("alias").MustString("")
		intervalMs := model.Get("intervalMs").MustInt64(0)
		interval := q.Interval

		queries = append(queries, &Query{
			RawQuery:      rawQuery,
			BucketAggs:    bucketAggs,
			Metrics:       metrics,
			Alias:         alias,
			Interval:      interval,
			IntervalMs:    intervalMs,
			RefID:         q.RefID,
			MaxDataPoints: q.MaxDataPoints,
			TimeRange:     q.TimeRange,
		})
	}

	return queries, nil
}

func parseBucketAggs(model *simplejson.Json) ([]*BucketAgg, error) {
	var err error
	bucketAggs := model.Get("bucketAggs").MustArray()
	result := make([]*BucketAgg, 0, len(bucketAggs))
	for _, t := range bucketAggs {
		aggJSON := simplejson.NewFromAny(t)
		agg := &BucketAgg{}

		agg.Type, err = aggJSON.Get("type").String()
		if err != nil {
			return nil, fmt.Errorf("failed to parse bucket aggs type: %w", err)
		}

		agg.ID, err = aggJSON.Get("id").String()
		if err != nil {
			return nil, fmt.Errorf("failed to parse bucket aggs id: %w", err)
		}

		agg.Field = aggJSON.Get("field").MustString()
		agg.Settings = simplejson.NewFromAny(aggJSON.Get("settings").MustMap())

		result = append(result, agg)
	}
	return result, nil
}

func parseMetrics(model *simplejson.Json) ([]*MetricAgg, error) {
	var err error
	metrics := model.Get("metrics").MustArray()
	result := make([]*MetricAgg, 0, len(metrics))
	for _, t := range metrics {
		metricJSON := simplejson.NewFromAny(t)
		metric := &MetricAgg{}

		metric.Field = metricJSON.Get("field").MustString()
		metric.Hide = metricJSON.Get("hide").MustBool(false)
		metric.ID = metricJSON.Get("id").MustString()
		metric.PipelineAggregate = metricJSON.Get("pipelineAgg").MustString()
		// In legacy editors, we were storing empty settings values as "null"
		// The new editor doesn't store empty strings at all
		// We need to ensures backward compatibility with old queries and remove empty fields
		settings := metricJSON.Get("settings").MustMap()
		for k, v := range settings {
			if v == "null" {
				delete(settings, k)
			}
		}
		metric.Settings = simplejson.NewFromAny(settings)
		metric.Meta = simplejson.NewFromAny(metricJSON.Get("meta").MustMap())
		metric.Type, err = metricJSON.Get("type").String()
		if err != nil {
			return nil, err
		}

		if isPipelineAggWithMultipleBucketPaths(metric.Type) {
			metric.PipelineVariables = map[string]string{}
			pvArr := metricJSON.Get("pipelineVariables").MustArray()
			for _, v := range pvArr {
				kv := v.(map[string]any)
				metric.PipelineVariables[kv["name"].(string)] = kv["pipelineAgg"].(string)
			}
		}

		result = append(result, metric)
	}
	return result, nil
}
