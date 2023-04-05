package elasticsearch

import (
	"encoding/json"
	"errors"
	"fmt"
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

var searchWordsRegex = regexp.MustCompile(regexp.QuoteMeta(es.HighlightPreTagsString) + `(.*?)` + regexp.QuoteMeta(es.HighlightPostTagsString))

func parseResponse(responses []*es.SearchResponse, targets []*Query, configuredFields es.ConfiguredFields) (*backend.QueryDataResponse, error) {
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

		if isRawDataQuery(target) {
			err := processRawDataResponse(res, target, configuredFields, &queryRes)
			if err != nil {
				return &backend.QueryDataResponse{}, err
			}
			result.Responses[target.RefID] = queryRes
		} else if isRawDocumentQuery(target) {
			err := processRawDocumentResponse(res, target, &queryRes)
			if err != nil {
				return &backend.QueryDataResponse{}, err
			}
			result.Responses[target.RefID] = queryRes
		} else if isLogsQuery(target) {
			err := processLogsResponse(res, target, configuredFields, &queryRes)
			if err != nil {
				return &backend.QueryDataResponse{}, err
			}
			result.Responses[target.RefID] = queryRes
		} else {
			// Process as metric query result
			props := make(map[string]string)
			err := processBuckets(res.Aggregations, target, &queryRes, props, 0)
			if err != nil {
				return &backend.QueryDataResponse{}, err
			}
			nameFields(queryRes, target)
			trimDatapoints(queryRes, target)

			result.Responses[target.RefID] = queryRes
		}
	}
	return &result, nil
}

func processLogsResponse(res *es.SearchResponse, target *Query, configuredFields es.ConfiguredFields, queryRes *backend.DataResponse) error {
	propNames := make(map[string]bool)
	docs := make([]map[string]interface{}, len(res.Hits.Hits))
	searchWords := make(map[string]bool)

	for hitIdx, hit := range res.Hits.Hits {
		var flattened map[string]interface{}
		if hit["_source"] != nil {
			flattened = flatten(hit["_source"].(map[string]interface{}))
		}

		doc := map[string]interface{}{
			"_id":       hit["_id"],
			"_type":     hit["_type"],
			"_index":    hit["_index"],
			"sort":      hit["sort"],
			"highlight": hit["highlight"],
			"_source":   flattened,
		}

		for k, v := range flattened {
			if configuredFields.LogLevelField != "" && k == configuredFields.LogLevelField {
				doc["level"] = v
			} else {
				doc[k] = v
			}
		}

		for key := range doc {
			propNames[key] = true
		}

		// Process highlight to searchWords
		if highlights, ok := doc["highlight"].(map[string]interface{}); ok {
			for _, highlight := range highlights {
				if highlightList, ok := highlight.([]interface{}); ok {
					for _, highlightValue := range highlightList {
						str := fmt.Sprintf("%v", highlightValue)
						matches := searchWordsRegex.FindAllStringSubmatch(str, -1)

						for _, v := range matches {
							searchWords[v[1]] = true
						}
					}
				}
			}
		}

		docs[hitIdx] = doc
	}

	sortedPropNames := sortPropNames(propNames, configuredFields, true)
	fields := processDocsToDataFrameFields(docs, sortedPropNames, configuredFields)

	frames := data.Frames{}
	frame := data.NewFrame("", fields...)
	setPreferredVisType(frame, data.VisTypeLogs)
	setSearchWords(frame, searchWords)
	frames = append(frames, frame)

	queryRes.Frames = frames
	return nil
}

func processRawDataResponse(res *es.SearchResponse, target *Query, configuredFields es.ConfiguredFields, queryRes *backend.DataResponse) error {
	propNames := make(map[string]bool)
	docs := make([]map[string]interface{}, len(res.Hits.Hits))

	for hitIdx, hit := range res.Hits.Hits {
		var flattened map[string]interface{}
		if hit["_source"] != nil {
			flattened = flatten(hit["_source"].(map[string]interface{}))
		}

		doc := map[string]interface{}{
			"_id":       hit["_id"],
			"_type":     hit["_type"],
			"_index":    hit["_index"],
			"sort":      hit["sort"],
			"highlight": hit["highlight"],
		}

		for k, v := range flattened {
			doc[k] = v
		}

		for key := range doc {
			propNames[key] = true
		}

		docs[hitIdx] = doc
	}

	sortedPropNames := sortPropNames(propNames, configuredFields, false)
	fields := processDocsToDataFrameFields(docs, sortedPropNames, configuredFields)

	frames := data.Frames{}
	frame := data.NewFrame("", fields...)
	frames = append(frames, frame)

	queryRes.Frames = frames
	return nil
}

func processRawDocumentResponse(res *es.SearchResponse, target *Query, queryRes *backend.DataResponse) error {
	docs := make([]map[string]interface{}, len(res.Hits.Hits))
	for hitIdx, hit := range res.Hits.Hits {
		doc := map[string]interface{}{
			"_id":       hit["_id"],
			"_type":     hit["_type"],
			"_index":    hit["_index"],
			"sort":      hit["sort"],
			"highlight": hit["highlight"],
		}

		if hit["_source"] != nil {
			source, ok := hit["_source"].(map[string]interface{})
			if ok {
				for k, v := range source {
					doc[k] = v
				}
			}
		}

		if hit["fields"] != nil {
			source, ok := hit["fields"].(map[string]interface{})
			if ok {
				for k, v := range source {
					doc[k] = v
				}
			}
		}

		docs[hitIdx] = doc
	}

	fieldVector := make([]*json.RawMessage, len(res.Hits.Hits))
	for i, doc := range docs {
		bytes, err := json.Marshal(doc)
		if err != nil {
			// We skip docs that can't be marshalled
			// should not happen
			continue
		}
		value := json.RawMessage(bytes)
		fieldVector[i] = &value
	}

	isFilterable := true
	field := data.NewField(target.RefID, nil, fieldVector)
	field.Config = &data.FieldConfig{Filterable: &isFilterable}

	frames := data.Frames{}
	frame := data.NewFrame(target.RefID, field)
	frames = append(frames, frame)

	queryRes.Frames = frames
	return nil
}

func processDocsToDataFrameFields(docs []map[string]interface{}, propNames []string, configuredFields es.ConfiguredFields) []*data.Field {
	size := len(docs)
	isFilterable := true
	allFields := make([]*data.Field, len(propNames))

	for propNameIdx, propName := range propNames {
		// Special handling for time field
		if propName == configuredFields.TimeField {
			timeVector := make([]*time.Time, size)
			for i, doc := range docs {
				timeString, ok := doc[configuredFields.TimeField].(string)
				if !ok {
					continue
				}
				timeValue, err := time.Parse(time.RFC3339Nano, timeString)
				if err != nil {
					// We skip time values that cannot be parsed
					continue
				} else {
					timeVector[i] = &timeValue
				}
			}
			field := data.NewField(configuredFields.TimeField, nil, timeVector)
			field.Config = &data.FieldConfig{Filterable: &isFilterable}
			allFields[propNameIdx] = field
			continue
		}

		propNameValue := findTheFirstNonNilDocValueForPropName(docs, propName)
		switch propNameValue.(type) {
		// We are checking for default data types values (float64, int, bool, string)
		// and default to json.RawMessage if we cannot find any of them
		case float64:
			allFields[propNameIdx] = createFieldOfType[float64](docs, propName, size, isFilterable)
		case int:
			allFields[propNameIdx] = createFieldOfType[int](docs, propName, size, isFilterable)
		case string:
			allFields[propNameIdx] = createFieldOfType[string](docs, propName, size, isFilterable)
		case bool:
			allFields[propNameIdx] = createFieldOfType[bool](docs, propName, size, isFilterable)
		default:
			fieldVector := make([]*json.RawMessage, size)
			for i, doc := range docs {
				bytes, err := json.Marshal(doc[propName])
				if err != nil {
					// We skip values that cannot be marshalled
					continue
				}
				value := json.RawMessage(bytes)
				fieldVector[i] = &value
			}
			field := data.NewField(propName, nil, fieldVector)
			field.Config = &data.FieldConfig{Filterable: &isFilterable}
			allFields[propNameIdx] = field
		}
	}

	return allFields
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
		data.NewField(data.TimeSeriesTimeFieldName, nil, timeData),
		data.NewField(data.TimeSeriesValueFieldName, tags, values))
	frame.Meta = &data.FrameMeta{
		Type: data.FrameTypeTimeSeriesMulti,
	}
	return frame
}

func processCountMetric(buckets []*simplejson.Json, props map[string]string) (data.Frames, error) {
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

func processPercentilesMetric(metric *MetricAgg, buckets []*simplejson.Json, props map[string]string) (data.Frames, error) {
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

func processTopMetricsMetric(metric *MetricAgg, buckets []*simplejson.Json, props map[string]string) (data.Frames, error) {
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

func processExtendedStatsMetric(metric *MetricAgg, buckets []*simplejson.Json, props map[string]string) (data.Frames, error) {
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

func processDefaultMetric(metric *MetricAgg, buckets []*simplejson.Json, props map[string]string) (data.Frames, error) {
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

// nolint:gocyclo
func processMetrics(esAgg *simplejson.Json, target *Query, query *backend.DataResponse,
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
			countFrames, err := processCountMetric(jsonBuckets, props)
			if err != nil {
				return err
			}
			frames = append(frames, countFrames...)
		case percentilesType:
			percentileFrames, err := processPercentilesMetric(metric, jsonBuckets, props)
			if err != nil {
				return err
			}
			frames = append(frames, percentileFrames...)
		case topMetricsType:
			topMetricsFrames, err := processTopMetricsMetric(metric, jsonBuckets, props)
			if err != nil {
				return err
			}
			frames = append(frames, topMetricsFrames...)
		case extendedStatsType:
			extendedStatsFrames, err := processExtendedStatsMetric(metric, jsonBuckets, props)
			if err != nil {
				return err
			}

			frames = append(frames, extendedStatsFrames...)
		default:
			defaultFrames, err := processDefaultMetric(metric, jsonBuckets, props)
			if err != nil {
				return err
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

func processAggregationDocs(esAgg *simplejson.Json, aggDef *BucketAgg, target *Query,
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
						return err
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
						metricName += " " + describeMetric(metric.Type, metric.Field)
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

func getAsTime(j *simplejson.Json) (time.Time, error) {
	// these are stored as numbers
	number, err := j.Float64()
	if err != nil {
		return time.Time{}, err
	}

	return time.UnixMilli(int64(number)).UTC(), nil
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

// flatten flattens multi-level objects to single level objects. It uses dot notation to join keys.
func flatten(target map[string]interface{}) map[string]interface{} {
	// On frontend maxDepth wasn't used but as we are processing on backend
	// let's put a limit to avoid infinite loop. 10 was chosen arbitrary.
	maxDepth := 10
	currentDepth := 0
	delimiter := ""
	output := make(map[string]interface{})

	var step func(object map[string]interface{}, prev string)

	step = func(object map[string]interface{}, prev string) {
		for key, value := range object {
			if prev == "" {
				delimiter = ""
			} else {
				delimiter = "."
			}
			newKey := prev + delimiter + key

			v, ok := value.(map[string]interface{})
			shouldStepInside := ok && len(v) > 0 && currentDepth < maxDepth
			if shouldStepInside {
				currentDepth++
				step(v, newKey)
			} else {
				output[newKey] = value
			}
		}
	}

	step(target, "")
	return output
}

// sortPropNames orders propNames so that timeField is first (if it exists), log message field is second
// if shouldSortLogMessageField is true, and rest of propNames are ordered alphabetically
func sortPropNames(propNames map[string]bool, configuredFields es.ConfiguredFields, shouldSortLogMessageField bool) []string {
	hasTimeField := false
	hasLogMessageField := false

	var sortedPropNames []string
	for k := range propNames {
		if configuredFields.TimeField != "" && k == configuredFields.TimeField {
			hasTimeField = true
		} else if shouldSortLogMessageField && configuredFields.LogMessageField != "" && k == configuredFields.LogMessageField {
			hasLogMessageField = true
		} else {
			sortedPropNames = append(sortedPropNames, k)
		}
	}

	sort.Strings(sortedPropNames)

	if hasLogMessageField {
		sortedPropNames = append([]string{configuredFields.LogMessageField}, sortedPropNames...)
	}

	if hasTimeField {
		sortedPropNames = append([]string{configuredFields.TimeField}, sortedPropNames...)
	}

	return sortedPropNames
}

// findTheFirstNonNilDocValueForPropName finds the first non-nil value for propName in docs. If none of the values are non-nil, it returns the value of propName in the first doc.
func findTheFirstNonNilDocValueForPropName(docs []map[string]interface{}, propName string) interface{} {
	for _, doc := range docs {
		if doc[propName] != nil {
			return doc[propName]
		}
	}
	return docs[0][propName]
}

func createFieldOfType[T int | float64 | bool | string](docs []map[string]interface{}, propName string, size int, isFilterable bool) *data.Field {
	fieldVector := make([]*T, size)
	for i, doc := range docs {
		value, ok := doc[propName].(T)
		if !ok {
			continue
		}
		fieldVector[i] = &value
	}
	field := data.NewField(propName, nil, fieldVector)
	field.Config = &data.FieldConfig{Filterable: &isFilterable}
	return field
}

func setPreferredVisType(frame *data.Frame, visType data.VisType) {
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}

	frame.Meta.PreferredVisualization = visType
}

func setSearchWords(frame *data.Frame, searchWords map[string]bool) {
	i := 0
	searchWordsList := make([]string, len(searchWords))
	for searchWord := range searchWords {
		searchWordsList[i] = searchWord
		i++
	}
	sort.Strings(searchWordsList)

	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}

	if frame.Meta.Custom == nil {
		frame.Meta.Custom = map[string]interface{}{}
	}

	frame.Meta.Custom = map[string]interface{}{
		"searchWords": searchWordsList,
	}
}

func createFields(frames data.Frames, propKeys []string) []*data.Field {
	var fields []*data.Field
	// Otherwise use the fields from frames
	if frames != nil {
		for _, frame := range frames {
			fields = append(fields, frame.Fields...)
		}
		// If we have no frames, we create fields from propKeys
	} else {
		for _, propKey := range propKeys {
			fields = append(fields, data.NewField(propKey, nil, []*string{}))
		}
	}
	return fields
}

func getSortedKeys(data map[string]interface{}) []string {
	keys := make([]string, 0, len(data))

	for k := range data {
		keys = append(keys, k)
	}

	sort.Strings(keys)
	return keys
}

func createPropKeys(props map[string]string) []string {
	propKeys := make([]string, 0)
	for k := range props {
		propKeys = append(propKeys, k)
	}
	sort.Strings(propKeys)
	return propKeys
}

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
	addMetricValueToFields(fields, values, metricName, castToFloat(bucket.GetPath(metric.ID, "value")))
}
