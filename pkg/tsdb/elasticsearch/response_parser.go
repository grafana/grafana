package elasticsearch

import (
	"errors"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/components/simplejson"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

const (
	// Metric types
	countType         = "count"
	percentilesType   = "percentiles"
	extendedStatsType = "extended_stats"
	topMetricsType    = "top_metrics"
	// Bucket types
	dateHistType    = "date_histogram"
	nestedType      = "nested"
	histogramType   = "histogram"
	filtersType     = "filters"
	termsType       = "terms"
	geohashGridType = "geohash_grid"
	//  Document types
	rawDocumentType = "raw_document"
	rawDataType     = "raw_data"
	// Logs type
	logsType = "logs"
)

func parseResponse(responses []*es.SearchResponse, targets []*Query) (*backend.QueryDataResponse, error) {
	result := backend.QueryDataResponse{
		Responses: backend.Responses{},
	}
	if responses == nil {
		return &result, nil
	}

	for i, res := range responses {
		target := targets[i]

		if res.Error != nil {
			errResult := getErrorFromElasticResponse(res)
			result.Responses[target.RefID] = backend.DataResponse{
				Error: errors.New(errResult),
			}
			continue
		}

		queryRes := backend.DataResponse{}

		props := make(map[string]string)
		err := processBuckets(res.Aggregations, target, &queryRes, props, 0)
		if err != nil {
			return &backend.QueryDataResponse{}, err
		}
		nameFields(queryRes, target)
		trimDatapoints(queryRes, target)

		result.Responses[target.RefID] = queryRes
	}
	return &result, nil
}

func processBuckets(aggs map[string]interface{}, target *Query,
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
			err = processBuckets(esAgg.MustMap(), target, queryResult, props, depth+1)
			if err != nil {
				return err
			}
			continue
		}

		if depth == maxDepth {
			if aggDef.Type == dateHistType {
				err = processMetrics(esAgg, target, queryResult, props)
			} else {
				err = processAggregationDocs(esAgg, aggDef, target, queryResult, props)
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
				err = processBuckets(bucket.MustMap(), target, queryResult, newProps, depth+1)
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

				err = processBuckets(bucket.MustMap(), target, queryResult, newProps, depth+1)
				if err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func newTimeSeriesFrame(timeData []time.Time, tags map[string]string, values []*float64) *data.Frame {
	frame := data.NewFrame("",
		data.NewField("time", nil, timeData),
		data.NewField("value", tags, values))
	frame.Meta = &data.FrameMeta{
		Type: data.FrameTypeTimeSeriesMulti,
	}
	return frame
}

// nolint:gocyclo
func processMetrics(esAgg *simplejson.Json, target *Query, query *backend.DataResponse,
	props map[string]string) error {
	frames := data.Frames{}
	esAggBuckets := esAgg.Get("buckets").MustArray()

	for _, metric := range target.Metrics {
		if metric.Hide {
			continue
		}

		tags := make(map[string]string, len(props))
		timeVector := make([]time.Time, 0, len(esAggBuckets))
		values := make([]*float64, 0, len(esAggBuckets))

		switch metric.Type {
		case countType:
			for _, v := range esAggBuckets {
				bucket := simplejson.NewFromAny(v)
				value := castToFloat(bucket.Get("doc_count"))
				key := castToFloat(bucket.Get("key"))
				timeVector = append(timeVector, time.Unix(int64(*key)/1000, 0).UTC())
				values = append(values, value)
			}

			for k, v := range props {
				tags[k] = v
			}
			tags["metric"] = countType
			frames = append(frames, newTimeSeriesFrame(timeVector, tags, values))
		case percentilesType:
			buckets := esAggBuckets
			if len(buckets) == 0 {
				break
			}

			firstBucket := simplejson.NewFromAny(buckets[0])
			percentiles := firstBucket.GetPath(metric.ID, "values").MustMap()

			percentileKeys := make([]string, 0)
			for k := range percentiles {
				percentileKeys = append(percentileKeys, k)
			}
			sort.Strings(percentileKeys)
			for _, percentileName := range percentileKeys {
				tags := make(map[string]string, len(props))
				timeVector := make([]time.Time, 0, len(esAggBuckets))
				values := make([]*float64, 0, len(esAggBuckets))

				for k, v := range props {
					tags[k] = v
				}
				tags["metric"] = "p" + percentileName
				tags["field"] = metric.Field
				for _, v := range buckets {
					bucket := simplejson.NewFromAny(v)
					value := castToFloat(bucket.GetPath(metric.ID, "values", percentileName))
					key := castToFloat(bucket.Get("key"))
					timeVector = append(timeVector, time.Unix(int64(*key)/1000, 0).UTC())
					values = append(values, value)
				}
				frames = append(frames, newTimeSeriesFrame(timeVector, tags, values))
			}
		case topMetricsType:
			buckets := esAggBuckets
			metrics := metric.Settings.Get("metrics").MustArray()

			for _, metricField := range metrics {
				tags := make(map[string]string, len(props))
				timeVector := make([]time.Time, 0, len(esAggBuckets))
				values := make([]*float64, 0, len(esAggBuckets))
				for k, v := range props {
					tags[k] = v
				}

				tags["field"] = metricField.(string)
				tags["metric"] = "top_metrics"

				for _, v := range buckets {
					bucket := simplejson.NewFromAny(v)
					stats := bucket.GetPath(metric.ID, "top")
					key := castToFloat(bucket.Get("key"))

					timeVector = append(timeVector, time.Unix(int64(*key)/1000, 0).UTC())

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

		case extendedStatsType:
			buckets := esAggBuckets

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

				tags := make(map[string]string, len(props))
				timeVector := make([]time.Time, 0, len(esAggBuckets))
				values := make([]*float64, 0, len(esAggBuckets))

				for k, v := range props {
					tags[k] = v
				}
				tags["metric"] = statName
				tags["field"] = metric.Field

				for _, v := range buckets {
					bucket := simplejson.NewFromAny(v)
					key := castToFloat(bucket.Get("key"))
					var value *float64
					switch statName {
					case "std_deviation_bounds_upper":
						value = castToFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "upper"))
					case "std_deviation_bounds_lower":
						value = castToFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "lower"))
					default:
						value = castToFloat(bucket.GetPath(metric.ID, statName))
					}
					timeVector = append(timeVector, time.Unix(int64(*key)/1000, 0).UTC())
					values = append(values, value)
				}
				labels := tags
				frames = append(frames, newTimeSeriesFrame(timeVector, labels, values))
			}
		default:
			for k, v := range props {
				tags[k] = v
			}

			tags["metric"] = metric.Type
			tags["field"] = metric.Field
			tags["metricId"] = metric.ID
			for _, v := range esAggBuckets {
				bucket := simplejson.NewFromAny(v)
				key := castToFloat(bucket.Get("key"))
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
				timeVector = append(timeVector, time.Unix(int64(*key)/1000, 0).UTC())
				values = append(values, value)
			}
			frames = append(frames, newTimeSeriesFrame(timeVector, tags, values))
		}
	}
	if query.Frames != nil {
		oldFrames := query.Frames
		frames = append(oldFrames, frames...)
	}
	query.Frames = frames
	return nil
}

func processAggregationDocs(esAgg *simplejson.Json, aggDef *BucketAgg, target *Query,
	queryResult *backend.DataResponse, props map[string]string) error {
	propKeys := make([]string, 0)
	for k := range props {
		propKeys = append(propKeys, k)
	}
	sort.Strings(propKeys)
	frames := data.Frames{}
	var fields []*data.Field

	if queryResult.Frames == nil {
		for _, propKey := range propKeys {
			fields = append(fields, data.NewField(propKey, nil, []*string{}))
		}
	}

	addMetricValue := func(values []interface{}, metricName string, value *float64) {
		index := -1
		for i, f := range fields {
			if f.Name == metricName {
				index = i
				break
			}
		}

		var field data.Field
		if index == -1 {
			field = *data.NewField(metricName, nil, []*float64{})
			fields = append(fields, &field)
		} else {
			field = *fields[index]
		}
		field.Append(value)
	}

	for _, v := range esAgg.Get("buckets").MustArray() {
		bucket := simplejson.NewFromAny(v)
		var values []interface{}

		found := false
		for _, e := range fields {
			for _, propKey := range propKeys {
				if e.Name == propKey {
					e.Append(props[propKey])
				}
			}
			if e.Name == aggDef.Field {
				found = true
				if key, err := bucket.Get("key").String(); err == nil {
					e.Append(&key)
				} else {
					f, err := bucket.Get("key").Float64()
					if err != nil {
						return err
					}
					e.Append(&f)
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
					return err
				}
				aggDefField = extractDataField(aggDef.Field, &f)
				aggDefField.Append(&f)
			}
			fields = append(fields, aggDefField)
		}

		for _, metric := range target.Metrics {
			switch metric.Type {
			case countType:
				addMetricValue(values, getMetricName(metric.Type), castToFloat(bucket.Get("doc_count")))
			case extendedStatsType:
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

					addMetricValue(values, getMetricName(metric.Type), value)
					break
				}
			default:
				metricName := getMetricName(metric.Type)
				otherMetrics := make([]*MetricAgg, 0)

				for _, m := range target.Metrics {
					if m.Type == metric.Type {
						otherMetrics = append(otherMetrics, m)
					}
				}

				if len(otherMetrics) > 1 {
					metricName += " " + metric.Field
					if metric.Type == "bucket_script" {
						// Use the formula in the column name
						metricName = metric.Settings.Get("script").MustString("")
					}
				}

				addMetricValue(values, metricName, castToFloat(bucket.GetPath(metric.ID, "value")))
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

func extractDataField(name string, v interface{}) *data.Field {
	switch v.(type) {
	case *string:
		return data.NewField(name, nil, []*string{})
	case *float64:
		return data.NewField(name, nil, []*float64{})
	default:
		return &data.Field{}
	}
}

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

// we sort the label's pairs by the label-key,
// and return the label-values
func getSortedLabelValues(labels data.Labels) []string {
	var keys []string
	for key := range labels {
		keys = append(keys, key)
	}

	sort.Strings(keys)

	var values []string
	for _, key := range keys {
		values = append(values, labels[key])
	}

	return values
}

func nameFields(queryResult backend.DataResponse, target *Query) {
	set := make(map[string]struct{})
	frames := queryResult.Frames
	for _, v := range frames {
		for _, vv := range v.Fields {
			if metricType, exists := vv.Labels["metric"]; exists {
				if _, ok := set[metricType]; !ok {
					set[metricType] = struct{}{}
				}
			}
		}
	}
	metricTypeCount := len(set)
	for _, frame := range frames {
		if frame.Meta != nil && frame.Meta.Type == data.FrameTypeTimeSeriesMulti {
			// if it is a time-series-multi, it means it has two columns, one is "time",
			// another is "number"
			valueField := frame.Fields[1]
			fieldName := getFieldName(*valueField, target, metricTypeCount)
			if fieldName != "" {
				valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: fieldName})
			}
		}
	}
}

var aliasPatternRegex = regexp.MustCompile(`\{\{([\s\S]+?)\}\}`)

func getFieldName(dataField data.Field, target *Query, metricTypeCount int) string {
	metricType := dataField.Labels["metric"]
	metricName := getMetricName(metricType)
	delete(dataField.Labels, "metric")

	field := ""
	if v, ok := dataField.Labels["field"]; ok {
		field = v
		delete(dataField.Labels, "field")
	}

	if target.Alias != "" {
		frameName := target.Alias

		subMatches := aliasPatternRegex.FindAllStringSubmatch(target.Alias, -1)
		for _, subMatch := range subMatches {
			group := subMatch[0]

			if len(subMatch) > 1 {
				group = subMatch[1]
			}

			if strings.Index(group, "term ") == 0 {
				frameName = strings.Replace(frameName, subMatch[0], dataField.Labels[group[5:]], 1)
			}
			if v, ok := dataField.Labels[group]; ok {
				frameName = strings.Replace(frameName, subMatch[0], v, 1)
			}
			if group == "metric" {
				frameName = strings.Replace(frameName, subMatch[0], metricName, 1)
			}
			if group == "field" {
				frameName = strings.Replace(frameName, subMatch[0], field, 1)
			}
		}

		return frameName
	}
	// todo, if field and pipelineAgg
	if isPipelineAgg(metricType) {
		if metricType != "" && isPipelineAggWithMultipleBucketPaths(metricType) {
			metricID := ""
			if v, ok := dataField.Labels["metricId"]; ok {
				metricID = v
			}

			for _, metric := range target.Metrics {
				if metric.ID == metricID {
					metricName = metric.Settings.Get("script").MustString()
					for name, pipelineAgg := range metric.PipelineVariables {
						for _, m := range target.Metrics {
							if m.ID == pipelineAgg {
								metricName = strings.ReplaceAll(metricName, "params."+name, describeMetric(m.Type, m.Field))
							}
						}
					}
				}
			}
		} else {
			if field != "" {
				found := false
				for _, metric := range target.Metrics {
					if metric.ID == field {
						metricName += " " + describeMetric(metric.Type, field)
						found = true
					}
				}
				if !found {
					metricName = "Unset"
				}
			}
		}
	} else if field != "" {
		metricName += " " + field
	}

	delete(dataField.Labels, "metricId")

	if len(dataField.Labels) == 0 {
		return metricName
	}

	name := ""
	for _, v := range getSortedLabelValues(dataField.Labels) {
		name += v + " "
	}

	if metricTypeCount == 1 {
		return strings.TrimSpace(name)
	}

	return strings.TrimSpace(name) + " " + metricName
}

func getMetricName(metric string) string {
	if text, ok := metricAggType[metric]; ok {
		return text
	}

	if text, ok := extendedStats[metric]; ok {
		return text
	}

	return metric
}

func castToInt(j *simplejson.Json) (int, error) {
	i, err := j.Int()
	if err == nil {
		return i, nil
	}

	s, err := j.String()
	if err != nil {
		return 0, err
	}

	v, err := strconv.Atoi(s)
	if err != nil {
		return 0, err
	}

	return v, nil
}

func castToFloat(j *simplejson.Json) *float64 {
	f, err := j.Float64()
	if err == nil {
		return &f
	}

	if s, err := j.String(); err == nil {
		if strings.ToLower(s) == "nan" {
			return nil
		}

		if v, err := strconv.ParseFloat(s, 64); err == nil {
			return &v
		}
	}

	return nil
}

func findAgg(target *Query, aggID string) (*BucketAgg, error) {
	for _, v := range target.BucketAggs {
		if aggID == v.ID {
			return v, nil
		}
	}
	return nil, errors.New("can't found aggDef, aggID:" + aggID)
}

func getErrorFromElasticResponse(response *es.SearchResponse) string {
	var errorString string
	json := simplejson.NewFromAny(response.Error)
	reason := json.Get("reason").MustString()
	rootCauseReason := json.Get("root_cause").GetIndex(0).Get("reason").MustString()
	causedByReason := json.Get("caused_by").Get("reason").MustString()

	switch {
	case rootCauseReason != "":
		errorString = rootCauseReason
	case reason != "":
		errorString = reason
	case causedByReason != "":
		errorString = causedByReason
	default:
		errorString = "Unknown elasticsearch error response"
	}

	return errorString
}
