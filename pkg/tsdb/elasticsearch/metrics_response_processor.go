package elasticsearch

import (
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

// metricsResponseProcessor handles processing of metrics query responses
type metricsResponseProcessor struct{}

// newMetricsResponseProcessor creates a new metrics response processor
func newMetricsResponseProcessor() *metricsResponseProcessor {
	return &metricsResponseProcessor{}
}

// processBuckets processes aggregation buckets recursively
func (p *metricsResponseProcessor) processBuckets(aggs map[string]interface{}, target *Query,
	queryResult *backend.DataResponse, props map[string]string, depth int) error {
	var err error
	maxDepth := len(target.BucketAggs) - 1

	aggIDs := make([]string, 0)
	for k := range aggs {
		aggIDs = append(aggIDs, k)
	}
	sort.Strings(aggIDs)
	for _, aggID := range aggIDs {
		v := aggs[aggID]
		aggDef, _ := findAgg(target, aggID)
		esAgg := simplejson.NewFromAny(v)
		if aggDef == nil {
			continue
		}
		if aggDef.Type == nestedType {
			err = p.processBuckets(esAgg.MustMap(), target, queryResult, props, depth+1)
			if err != nil {
				return err
			}
			continue
		}

		if depth == maxDepth {
			if aggDef.Type == dateHistType {
				err = p.processMetrics(esAgg, target, queryResult, props)
			} else {
				err = p.processAggregationDocs(esAgg, aggDef, target, queryResult, props)
			}
			if err != nil {
				return err
			}
		} else {
			for _, b := range esAgg.Get("buckets").MustArray() {
				bucket := simplejson.NewFromAny(b)
				newProps := make(map[string]string)

				for k, v := range props {
					newProps[k] = v
				}

				if key, err := bucket.Get("key").String(); err == nil {
					newProps[aggDef.Field] = key
				} else if key, err := bucket.Get("key").Int64(); err == nil {
					newProps[aggDef.Field] = strconv.FormatInt(key, 10)
				}

				if key, err := bucket.Get("key_as_string").String(); err == nil {
					newProps[aggDef.Field] = key
				}
				err = p.processBuckets(bucket.MustMap(), target, queryResult, newProps, depth+1)
				if err != nil {
					return err
				}
			}

			buckets := esAgg.Get("buckets").MustMap()
			bucketKeys := make([]string, 0)
			for k := range buckets {
				bucketKeys = append(bucketKeys, k)
			}
			sort.Strings(bucketKeys)

			for _, bucketKey := range bucketKeys {
				bucket := simplejson.NewFromAny(buckets[bucketKey])
				newProps := make(map[string]string)

				for k, v := range props {
					newProps[k] = v
				}

				newProps["filter"] = bucketKey

				err = p.processBuckets(bucket.MustMap(), target, queryResult, newProps, depth+1)
				if err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// processMetrics processes metric aggregations from date histogram buckets
func (p *metricsResponseProcessor) processMetrics(esAgg *simplejson.Json, target *Query, query *backend.DataResponse,
	props map[string]string) error {
	frames := data.Frames{}
	esAggBuckets := esAgg.Get("buckets").MustArray()

	jsonBuckets := make([]*simplejson.Json, len(esAggBuckets))

	for i, v := range esAggBuckets {
		jsonBuckets[i] = simplejson.NewFromAny(v)
	}

	for _, metric := range target.Metrics {
		if metric.Hide {
			continue
		}

		switch metric.Type {
		case countType:
			countFrames, err := p.processCountMetric(jsonBuckets, props)
			if err != nil {
				return fmt.Errorf("error processing count metric: %w", err)
			}
			frames = append(frames, countFrames...)
		case percentilesType:
			percentileFrames, err := p.processPercentilesMetric(metric, jsonBuckets, props)
			if err != nil {
				return fmt.Errorf("error processing percentiles metric: %w", err)
			}
			frames = append(frames, percentileFrames...)
		case topMetricsType:
			topMetricsFrames, err := p.processTopMetricsMetric(metric, jsonBuckets, props)
			if err != nil {
				return fmt.Errorf("error processing top metrics metric: %w", err)
			}
			frames = append(frames, topMetricsFrames...)
		case extendedStatsType:
			extendedStatsFrames, err := p.processExtendedStatsMetric(metric, jsonBuckets, props)
			if err != nil {
				return fmt.Errorf("error processing extended stats metric: %w", err)
			}

			frames = append(frames, extendedStatsFrames...)
		default:
			defaultFrames, err := p.processDefaultMetric(metric, jsonBuckets, props)
			if err != nil {
				return fmt.Errorf("error processing default metric: %w", err)
			}
			frames = append(frames, defaultFrames...)
		}
	}
	if query.Frames != nil {
		oldFrames := query.Frames
		frames = append(oldFrames, frames...)
	}
	query.Frames = frames
	return nil
}

// processCountMetric processes count metric aggregations
func (p *metricsResponseProcessor) processCountMetric(buckets []*simplejson.Json, props map[string]string) (data.Frames, error) {
	tags := make(map[string]string, len(props))
	timeVector := make([]time.Time, 0, len(buckets))
	values := make([]*float64, 0, len(buckets))

	for _, bucket := range buckets {
		value := castToFloat(bucket.Get("doc_count"))
		timeValue, err := getAsTime(bucket.Get("key"))
		if err != nil {
			return nil, err
		}
		timeVector = append(timeVector, timeValue)
		values = append(values, value)
	}

	for k, v := range props {
		tags[k] = v
	}
	tags["metric"] = countType
	return data.Frames{newTimeSeriesFrame(timeVector, tags, values)}, nil
}

// processPercentilesMetric processes percentiles metric aggregations
func (p *metricsResponseProcessor) processPercentilesMetric(metric *MetricAgg, buckets []*simplejson.Json, props map[string]string) (data.Frames, error) {
	if len(buckets) == 0 {
		return data.Frames{}, nil
	}

	firstBucket := buckets[0]
	percentiles := firstBucket.GetPath(metric.ID, "values").MustMap()

	percentileKeys := make([]string, 0)
	for k := range percentiles {
		percentileKeys = append(percentileKeys, k)
	}
	sort.Strings(percentileKeys)

	frames := data.Frames{}

	for _, percentileName := range percentileKeys {
		tags := make(map[string]string, len(props))
		timeVector := make([]time.Time, 0, len(buckets))
		values := make([]*float64, 0, len(buckets))

		for k, v := range props {
			tags[k] = v
		}
		tags["metric"] = "p" + percentileName
		tags["field"] = metric.Field
		for _, bucket := range buckets {
			value := castToFloat(bucket.GetPath(metric.ID, "values", percentileName))
			key := bucket.Get("key")
			timeValue, err := getAsTime(key)
			if err != nil {
				return nil, err
			}
			timeVector = append(timeVector, timeValue)
			values = append(values, value)
		}
		frames = append(frames, newTimeSeriesFrame(timeVector, tags, values))
	}

	return frames, nil
}

// processTopMetricsMetric processes top_metrics metric aggregations
func (p *metricsResponseProcessor) processTopMetricsMetric(metric *MetricAgg, buckets []*simplejson.Json, props map[string]string) (data.Frames, error) {
	metrics := metric.Settings.Get("metrics").MustArray()

	frames := data.Frames{}

	for _, metricField := range metrics {
		tags := make(map[string]string, len(props))
		timeVector := make([]time.Time, 0, len(buckets))
		values := make([]*float64, 0, len(buckets))
		for k, v := range props {
			tags[k] = v
		}

		tags["field"] = metricField.(string)
		tags["metric"] = "top_metrics"

		for _, bucket := range buckets {
			stats := bucket.GetPath(metric.ID, "top")
			timeValue, err := getAsTime(bucket.Get("key"))
			if err != nil {
				return nil, err
			}
			timeVector = append(timeVector, timeValue)

			for _, stat := range stats.MustArray() {
				stat := stat.(map[string]interface{})

				metrics, hasMetrics := stat["metrics"]
				if hasMetrics {
					metrics := metrics.(map[string]interface{})
					metricValue, hasMetricValue := metrics[metricField.(string)]

					if hasMetricValue && metricValue != nil {
						v := metricValue.(float64)
						values = append(values, &v)
					}
				}
			}
		}

		frames = append(frames, newTimeSeriesFrame(timeVector, tags, values))
	}

	return frames, nil
}

// processExtendedStatsMetric processes extended_stats metric aggregations
func (p *metricsResponseProcessor) processExtendedStatsMetric(metric *MetricAgg, buckets []*simplejson.Json, props map[string]string) (data.Frames, error) {
	metaKeys := make([]string, 0)
	meta := metric.Meta.MustMap()
	for k := range meta {
		metaKeys = append(metaKeys, k)
	}
	sort.Strings(metaKeys)

	frames := data.Frames{}

	for _, statName := range metaKeys {
		v := meta[statName]
		if enabled, ok := v.(bool); !ok || !enabled {
			continue
		}

		tags := make(map[string]string, len(props))
		timeVector := make([]time.Time, 0, len(buckets))
		values := make([]*float64, 0, len(buckets))

		for k, v := range props {
			tags[k] = v
		}
		tags["metric"] = statName
		tags["field"] = metric.Field

		for _, bucket := range buckets {
			timeValue, err := getAsTime(bucket.Get("key"))
			if err != nil {
				return nil, err
			}
			var value *float64
			switch statName {
			case "std_deviation_bounds_upper":
				value = castToFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "upper"))
			case "std_deviation_bounds_lower":
				value = castToFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "lower"))
			default:
				value = castToFloat(bucket.GetPath(metric.ID, statName))
			}
			timeVector = append(timeVector, timeValue)
			values = append(values, value)
		}
		labels := tags
		frames = append(frames, newTimeSeriesFrame(timeVector, labels, values))
	}

	return frames, nil
}

// processDefaultMetric processes default metric aggregations
func (p *metricsResponseProcessor) processDefaultMetric(metric *MetricAgg, buckets []*simplejson.Json, props map[string]string) (data.Frames, error) {
	tags := make(map[string]string, len(props))
	timeVector := make([]time.Time, 0, len(buckets))
	values := make([]*float64, 0, len(buckets))

	for k, v := range props {
		tags[k] = v
	}

	tags["metric"] = metric.Type
	tags["field"] = metric.Field
	tags["metricId"] = metric.ID
	for _, bucket := range buckets {
		timeValue, err := getAsTime(bucket.Get("key"))
		if err != nil {
			return nil, err
		}
		valueObj, err := bucket.Get(metric.ID).Map()
		if err != nil {
			continue
		}
		var value *float64
		if _, ok := valueObj["normalized_value"]; ok {
			value = castToFloat(bucket.GetPath(metric.ID, "normalized_value"))
		} else {
			value = castToFloat(bucket.GetPath(metric.ID, "value"))
		}
		timeVector = append(timeVector, timeValue)
		values = append(values, value)
	}
	return data.Frames{newTimeSeriesFrame(timeVector, tags, values)}, nil
}

// processAggregationDocs processes aggregation documents for non-date histogram aggregations
func (p *metricsResponseProcessor) processAggregationDocs(esAgg *simplejson.Json, aggDef *BucketAgg, target *Query,
	queryResult *backend.DataResponse, props map[string]string) error {
	propKeys := createPropKeys(props)
	frames := data.Frames{}
	fields := createFields(queryResult.Frames, propKeys)

	for _, v := range esAgg.Get("buckets").MustArray() {
		bucket := simplejson.NewFromAny(v)
		var values []interface{}

		found := false
		for _, field := range fields {
			for _, propKey := range propKeys {
				if field.Name == propKey {
					value := props[propKey]
					field.Append(&value)
				}
			}
			if field.Name == aggDef.Field {
				found = true
				if key, err := bucket.Get("key").String(); err == nil {
					field.Append(&key)
				} else {
					f, err := bucket.Get("key").Float64()
					if err != nil {
						return fmt.Errorf("error appending bucket key to existing field with name %s: %w", field.Name, err)
					}
					field.Append(&f)
				}
			}
		}

		if !found {
			var aggDefField *data.Field
			if key, err := bucket.Get("key").String(); err == nil {
				aggDefField = extractDataField(aggDef.Field, &key)
				aggDefField.Append(&key)
			} else {
				f, err := bucket.Get("key").Float64()
				if err != nil {
					return fmt.Errorf("error appending bucket key to new field with name %s: %w", aggDef.Field, err)
				}
				aggDefField = extractDataField(aggDef.Field, &f)
				aggDefField.Append(&f)
			}
			fields = append(fields, aggDefField)
		}

		for _, metric := range target.Metrics {
			switch metric.Type {
			case countType:
				addMetricValueToFields(&fields, values, getMetricName(metric.Type), castToFloat(bucket.Get("doc_count")))
			case extendedStatsType:
				addExtendedStatsToFields(&fields, bucket, metric, values)
			case percentilesType:
				addPercentilesToFields(&fields, bucket, metric, values)
			case topMetricsType:
				addTopMetricsToFields(&fields, bucket, metric, values)
			default:
				addOtherMetricsToFields(&fields, bucket, metric, values, target)
			}
		}

		var dataFields []*data.Field
		dataFields = append(dataFields, fields...)

		frames = data.Frames{
			&data.Frame{
				Fields: dataFields,
			}}
	}
	queryResult.Frames = frames
	return nil
}

// newTimeSeriesFrame creates a new time series frame
func newTimeSeriesFrame(timeData []time.Time, tags map[string]string, values []*float64) *data.Frame {
	frame := data.NewFrame("",
		data.NewField(data.TimeSeriesTimeFieldName, nil, timeData),
		data.NewField(data.TimeSeriesValueFieldName, tags, values))
	frame.Meta = &data.FrameMeta{
		Type: data.FrameTypeTimeSeriesMulti,
	}
	return frame
}

// trimDatapoints trims datapoints from the beginning and end of the results
func trimDatapoints(queryResult backend.DataResponse, target *Query) {
	var histogram *BucketAgg
	for _, bucketAgg := range target.BucketAggs {
		if bucketAgg.Type == dateHistType {
			histogram = bucketAgg
			break
		}
	}

	if histogram == nil {
		return
	}

	trimEdges, err := castToInt(histogram.Settings.Get("trimEdges"))
	if err != nil {
		return
	}

	frames := queryResult.Frames

	for _, frame := range frames {
		for _, field := range frame.Fields {
			if field.Len() > trimEdges*2 {
				// first we delete the first "trim" items
				for i := 0; i < trimEdges; i++ {
					field.Delete(0)
				}

				// then we delete the last "trim" items
				for i := 0; i < trimEdges; i++ {
					field.Delete(field.Len() - 1)
				}
			}
		}
	}
}

// Helper functions for adding metrics to fields

func addMetricValueToFields(fields *[]*data.Field, values []interface{}, metricName string, value *float64) {
	index := -1
	for i, f := range *fields {
		if f.Name == metricName {
			index = i
			break
		}
	}

	var field data.Field
	if index == -1 {
		field = *data.NewField(metricName, nil, []*float64{})
		*fields = append(*fields, &field)
	} else {
		field = *(*fields)[index]
	}
	field.Append(value)
}

func addPercentilesToFields(fields *[]*data.Field, bucket *simplejson.Json, metric *MetricAgg, values []interface{}) {
	percentiles := bucket.GetPath(metric.ID, "values")
	for _, percentileName := range getSortedKeys(percentiles.MustMap()) {
		percentileValue := percentiles.Get(percentileName).MustFloat64()
		addMetricValueToFields(fields, values, fmt.Sprintf("p%v %v", percentileName, metric.Field), &percentileValue)
	}
}

func addExtendedStatsToFields(fields *[]*data.Field, bucket *simplejson.Json, metric *MetricAgg, values []interface{}) {
	metaKeys := make([]string, 0)
	meta := metric.Meta.MustMap()
	for k := range meta {
		metaKeys = append(metaKeys, k)
	}
	sort.Strings(metaKeys)
	for _, statName := range metaKeys {
		v := meta[statName]
		if enabled, ok := v.(bool); !ok || !enabled {
			continue
		}
		var value *float64
		switch statName {
		case "std_deviation_bounds_upper":
			value = castToFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "upper"))
		case "std_deviation_bounds_lower":
			value = castToFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "lower"))
		default:
			value = castToFloat(bucket.GetPath(metric.ID, statName))
		}

		addMetricValueToFields(fields, values, getMetricName(metric.Type), value)
		break
	}
}

func addTopMetricsToFields(fields *[]*data.Field, bucket *simplejson.Json, metric *MetricAgg, values []interface{}) {
	baseName := getMetricName(metric.Type)
	metrics := metric.Settings.Get("metrics").MustStringArray()
	for _, metricField := range metrics {
		// If we selected more than one metric we also add each metric name
		metricName := baseName
		if len(metrics) > 1 {
			metricName += " " + metricField
		}
		top := bucket.GetPath(metric.ID, "top").MustArray()
		metrics, hasMetrics := top[0].(map[string]interface{})["metrics"]
		if hasMetrics {
			metrics := metrics.(map[string]interface{})
			metricValue, hasMetricValue := metrics[metricField]
			if hasMetricValue && metricValue != nil {
				v := metricValue.(float64)
				addMetricValueToFields(fields, values, metricName, &v)
			}
		}
	}
}

func addOtherMetricsToFields(fields *[]*data.Field, bucket *simplejson.Json, metric *MetricAgg, values []interface{}, target *Query) {
	metricName := getMetricName(metric.Type)
	otherMetrics := make([]*MetricAgg, 0)

	for _, m := range target.Metrics {
		// To other metrics we add metric of the same type that are not the current metric
		if m.ID != metric.ID && m.Type == metric.Type {
			otherMetrics = append(otherMetrics, m)
		}
	}

	if len(otherMetrics) > 0 {
		metricName += " " + metric.Field

		// We check if we have metric with the same type and same field name
		// If so, append metric.ID to the metric name
		for _, m := range otherMetrics {
			if m.Field == metric.Field {
				metricName += " " + metric.ID
				break
			}
		}

		if metric.Type == "bucket_script" {
			// Use the formula in the column name
			metricName = metric.Settings.Get("script").MustString("")
		}
	}
	addMetricValueToFields(fields, values, metricName, castToFloat(bucket.GetPath(metric.ID, "value")))
}

func extractDataField(name string, v interface{}) *data.Field {
	var field *data.Field
	switch v.(type) {
	case *string:
		field = data.NewField(name, nil, []*string{})
	case *float64:
		field = data.NewField(name, nil, []*float64{})
	default:
		field = &data.Field{}
	}
	isFilterable := true
	field.Config = &data.FieldConfig{Filterable: &isFilterable}
	return field
}
