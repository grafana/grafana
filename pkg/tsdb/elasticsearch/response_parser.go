package elasticsearch

import (
	"errors"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/plugins"
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
	histogramType   = "histogram"
	filtersType     = "filters"
	termsType       = "terms"
	geohashGridType = "geohash_grid"
)

type responseParser struct {
	Responses []*es.SearchResponse
	Targets   []*Query
	DebugInfo *es.SearchDebugInfo
}

var newResponseParser = func(responses []*es.SearchResponse, targets []*Query, debugInfo *es.SearchDebugInfo) *responseParser {
	return &responseParser{
		Responses: responses,
		Targets:   targets,
		DebugInfo: debugInfo,
	}
}

// nolint:staticcheck // plugins.DataResponse deprecated
func (rp *responseParser) getTimeSeries() (plugins.DataResponse, error) {
	result := plugins.DataResponse{
		Results: make(map[string]plugins.DataQueryResult),
	}
	if rp.Responses == nil {
		return result, nil
	}

	for i, res := range rp.Responses {
		target := rp.Targets[i]

		var debugInfo *simplejson.Json
		if rp.DebugInfo != nil && i == 0 {
			debugInfo = simplejson.NewFromAny(rp.DebugInfo)
		}

		if res.Error != nil {
			errRslt := getErrorFromElasticResponse(res)
			errRslt.Meta = debugInfo
			result.Results[target.RefID] = errRslt
			continue
		}

		queryRes := plugins.DataQueryResult{
			Meta: debugInfo,
		}
		props := make(map[string]string)
		table := plugins.DataTable{
			Columns: make([]plugins.DataTableColumn, 0),
			Rows:    make([]plugins.DataRowValues, 0),
		}
		err := rp.processBuckets(res.Aggregations, target, &queryRes.Series, &table, props, 0)
		if err != nil {
			return plugins.DataResponse{}, err
		}
		rp.nameSeries(queryRes.Series, target)
		rp.trimDatapoints(queryRes.Series, target)

		if len(table.Rows) > 0 {
			queryRes.Tables = append(queryRes.Tables, table)
		}

		result.Results[target.RefID] = queryRes
	}
	return result, nil
}

// nolint:staticcheck // plugins.* deprecated
func (rp *responseParser) processBuckets(aggs map[string]interface{}, target *Query,
	series *plugins.DataTimeSeriesSlice, table *plugins.DataTable, props map[string]string, depth int) error {
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

		if depth == maxDepth {
			if aggDef.Type == dateHistType {
				err = rp.processMetrics(esAgg, target, series, props)
			} else {
				err = rp.processAggregationDocs(esAgg, aggDef, target, table, props)
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
				err = rp.processBuckets(bucket.MustMap(), target, series, table, newProps, depth+1)
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

				err = rp.processBuckets(bucket.MustMap(), target, series, table, newProps, depth+1)
				if err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// nolint:staticcheck // plugins.* deprecated
func (rp *responseParser) processMetrics(esAgg *simplejson.Json, target *Query, series *plugins.DataTimeSeriesSlice,
	props map[string]string) error {
	for _, metric := range target.Metrics {
		if metric.Hide {
			continue
		}

		switch metric.Type {
		case countType:
			newSeries := plugins.DataTimeSeries{
				Tags: make(map[string]string),
			}

			for _, v := range esAgg.Get("buckets").MustArray() {
				bucket := simplejson.NewFromAny(v)
				value := castToNullFloat(bucket.Get("doc_count"))
				key := castToNullFloat(bucket.Get("key"))
				newSeries.Points = append(newSeries.Points, plugins.DataTimePoint{value, key})
			}

			for k, v := range props {
				newSeries.Tags[k] = v
			}
			newSeries.Tags["metric"] = countType
			*series = append(*series, newSeries)

		case percentilesType:
			buckets := esAgg.Get("buckets").MustArray()
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
				newSeries := plugins.DataTimeSeries{
					Tags: make(map[string]string),
				}
				for k, v := range props {
					newSeries.Tags[k] = v
				}
				newSeries.Tags["metric"] = "p" + percentileName
				newSeries.Tags["field"] = metric.Field
				for _, v := range buckets {
					bucket := simplejson.NewFromAny(v)
					value := castToNullFloat(bucket.GetPath(metric.ID, "values", percentileName))
					key := castToNullFloat(bucket.Get("key"))
					newSeries.Points = append(newSeries.Points, plugins.DataTimePoint{value, key})
				}
				*series = append(*series, newSeries)
			}
		case topMetricsType:
			topMetricSeries := processTopMetrics(metric, esAgg, props)
			*series = append(*series, topMetricSeries...)

		case extendedStatsType:
			buckets := esAgg.Get("buckets").MustArray()

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

				newSeries := plugins.DataTimeSeries{
					Tags: make(map[string]string),
				}
				for k, v := range props {
					newSeries.Tags[k] = v
				}
				newSeries.Tags["metric"] = statName
				newSeries.Tags["field"] = metric.Field

				for _, v := range buckets {
					bucket := simplejson.NewFromAny(v)
					key := castToNullFloat(bucket.Get("key"))
					var value null.Float
					switch statName {
					case "std_deviation_bounds_upper":
						value = castToNullFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "upper"))
					case "std_deviation_bounds_lower":
						value = castToNullFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "lower"))
					default:
						value = castToNullFloat(bucket.GetPath(metric.ID, statName))
					}
					newSeries.Points = append(newSeries.Points, plugins.DataTimePoint{value, key})
				}
				*series = append(*series, newSeries)
			}
		default:
			newSeries := plugins.DataTimeSeries{
				Tags: make(map[string]string),
			}
			for k, v := range props {
				newSeries.Tags[k] = v
			}

			newSeries.Tags["metric"] = metric.Type
			newSeries.Tags["field"] = metric.Field
			newSeries.Tags["metricId"] = metric.ID
			for _, v := range esAgg.Get("buckets").MustArray() {
				bucket := simplejson.NewFromAny(v)
				key := castToNullFloat(bucket.Get("key"))
				valueObj, err := bucket.Get(metric.ID).Map()
				if err != nil {
					continue
				}
				var value null.Float
				if _, ok := valueObj["normalized_value"]; ok {
					value = castToNullFloat(bucket.GetPath(metric.ID, "normalized_value"))
				} else {
					value = castToNullFloat(bucket.GetPath(metric.ID, "value"))
				}
				newSeries.Points = append(newSeries.Points, plugins.DataTimePoint{value, key})
			}
			*series = append(*series, newSeries)
		}
	}
	return nil
}

// nolint:staticcheck // plugins.* deprecated
func (rp *responseParser) processAggregationDocs(esAgg *simplejson.Json, aggDef *BucketAgg, target *Query,
	table *plugins.DataTable, props map[string]string) error {
	propKeys := make([]string, 0)
	for k := range props {
		propKeys = append(propKeys, k)
	}
	sort.Strings(propKeys)

	if len(table.Columns) == 0 {
		for _, propKey := range propKeys {
			table.Columns = append(table.Columns, plugins.DataTableColumn{Text: propKey})
		}
		table.Columns = append(table.Columns, plugins.DataTableColumn{Text: aggDef.Field})
	}

	addMetricValue := func(values *plugins.DataRowValues, metricName string, value null.Float) {
		found := false
		for _, c := range table.Columns {
			if c.Text == metricName {
				found = true
				break
			}
		}
		if !found {
			table.Columns = append(table.Columns, plugins.DataTableColumn{Text: metricName})
		}
		*values = append(*values, value)
	}

	for _, v := range esAgg.Get("buckets").MustArray() {
		bucket := simplejson.NewFromAny(v)
		values := make(plugins.DataRowValues, 0)

		for _, propKey := range propKeys {
			values = append(values, props[propKey])
		}

		if key, err := bucket.Get("key").String(); err == nil {
			values = append(values, key)
		} else {
			values = append(values, castToNullFloat(bucket.Get("key")))
		}

		for _, metric := range target.Metrics {
			switch metric.Type {
			case countType:
				addMetricValue(&values, rp.getMetricName(metric.Type), castToNullFloat(bucket.Get("doc_count")))
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

					var value null.Float
					switch statName {
					case "std_deviation_bounds_upper":
						value = castToNullFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "upper"))
					case "std_deviation_bounds_lower":
						value = castToNullFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "lower"))
					default:
						value = castToNullFloat(bucket.GetPath(metric.ID, statName))
					}

					addMetricValue(&values, rp.getMetricName(metric.Type), value)
					break
				}
			default:
				metricName := rp.getMetricName(metric.Type)
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

				addMetricValue(&values, metricName, castToNullFloat(bucket.GetPath(metric.ID, "value")))
			}
		}

		table.Rows = append(table.Rows, values)
	}

	return nil
}

func (rp *responseParser) trimDatapoints(series plugins.DataTimeSeriesSlice, target *Query) {
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

	trimEdges, err := histogram.Settings.Get("trimEdges").Int()
	if err != nil {
		return
	}

	for i := range series {
		if len(series[i].Points) > trimEdges*2 {
			series[i].Points = series[i].Points[trimEdges : len(series[i].Points)-trimEdges]
		}
	}
}

func (rp *responseParser) nameSeries(seriesList plugins.DataTimeSeriesSlice, target *Query) {
	set := make(map[string]struct{})
	for _, v := range seriesList {
		if metricType, exists := v.Tags["metric"]; exists {
			if _, ok := set[metricType]; !ok {
				set[metricType] = struct{}{}
			}
		}
	}
	metricTypeCount := len(set)
	for i := range seriesList {
		seriesList[i].Name = rp.getSeriesName(seriesList[i], target, metricTypeCount)
	}
}

var aliasPatternRegex = regexp.MustCompile(`\{\{([\s\S]+?)\}\}`)

// nolint:staticcheck // plugins.* deprecated
func (rp *responseParser) getSeriesName(series plugins.DataTimeSeries, target *Query, metricTypeCount int) string {
	metricType := series.Tags["metric"]
	metricName := rp.getMetricName(metricType)
	delete(series.Tags, "metric")

	field := ""
	if v, ok := series.Tags["field"]; ok {
		field = v
		delete(series.Tags, "field")
	}

	if target.Alias != "" {
		seriesName := target.Alias

		subMatches := aliasPatternRegex.FindAllStringSubmatch(target.Alias, -1)
		for _, subMatch := range subMatches {
			group := subMatch[0]

			if len(subMatch) > 1 {
				group = subMatch[1]
			}

			if strings.Index(group, "term ") == 0 {
				seriesName = strings.Replace(seriesName, subMatch[0], series.Tags[group[5:]], 1)
			}
			if v, ok := series.Tags[group]; ok {
				seriesName = strings.Replace(seriesName, subMatch[0], v, 1)
			}
			if group == "metric" {
				seriesName = strings.Replace(seriesName, subMatch[0], metricName, 1)
			}
			if group == "field" {
				seriesName = strings.Replace(seriesName, subMatch[0], field, 1)
			}
		}

		return seriesName
	}
	// todo, if field and pipelineAgg
	if field != "" && isPipelineAgg(metricType) {
		if isPipelineAggWithMultipleBucketPaths(metricType) {
			metricID := ""
			if v, ok := series.Tags["metricId"]; ok {
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
	} else if field != "" {
		metricName += " " + field
	}

	delete(series.Tags, "metricId")

	if len(series.Tags) == 0 {
		return metricName
	}

	name := ""
	for _, v := range series.Tags {
		name += v + " "
	}

	if metricTypeCount == 1 {
		return strings.TrimSpace(name)
	}

	return strings.TrimSpace(name) + " " + metricName
}

func (rp *responseParser) getMetricName(metric string) string {
	if text, ok := metricAggType[metric]; ok {
		return text
	}

	if text, ok := extendedStats[metric]; ok {
		return text
	}

	return metric
}

func castToNullFloat(j *simplejson.Json) null.Float {
	f, err := j.Float64()
	if err == nil {
		return null.FloatFrom(f)
	}

	if s, err := j.String(); err == nil {
		if strings.ToLower(s) == "nan" {
			return null.NewFloat(0, false)
		}

		if v, err := strconv.ParseFloat(s, 64); err == nil {
			return null.FloatFromPtr(&v)
		}
	}

	return null.NewFloat(0, false)
}

func findAgg(target *Query, aggID string) (*BucketAgg, error) {
	for _, v := range target.BucketAggs {
		if aggID == v.ID {
			return v, nil
		}
	}
	return nil, errors.New("can't found aggDef, aggID:" + aggID)
}

// nolint:staticcheck // plugins.DataQueryResult deprecated
func getErrorFromElasticResponse(response *es.SearchResponse) plugins.DataQueryResult {
	var result plugins.DataQueryResult
	json := simplejson.NewFromAny(response.Error)
	reason := json.Get("reason").MustString()
	rootCauseReason := json.Get("root_cause").GetIndex(0).Get("reason").MustString()

	switch {
	case rootCauseReason != "":
		result.ErrorString = rootCauseReason
	case reason != "":
		result.ErrorString = reason
	default:
		result.ErrorString = "Unknown elasticsearch error response"
	}

	return result
}

func processTopMetricValues(stats *simplejson.Json, field string) null.Float {
	for _, stat := range stats.MustArray() {
		stat := stat.(map[string]interface{})
		metrics, hasMetrics := stat["metrics"]
		if hasMetrics {
			metrics := metrics.(map[string]interface{})
			metricValue, hasMetricValue := metrics[field]
			if hasMetricValue && metricValue != nil {
				return null.FloatFrom(metricValue.(float64))
			}
		}
	}
	return null.NewFloat(0, false)
}

func processTopMetrics(metric *MetricAgg, esAgg *simplejson.Json, props map[string]string) plugins.DataTimeSeriesSlice {
	var series plugins.DataTimeSeriesSlice
	metrics, hasMetrics := metric.Settings.MustMap()["metrics"].([]interface{})

	if hasMetrics {
		for _, metricField := range metrics {
			newSeries := plugins.DataTimeSeries{
				Tags: make(map[string]string),
			}

			for _, v := range esAgg.Get("buckets").MustArray() {
				bucket := simplejson.NewFromAny(v)
				stats := bucket.GetPath(metric.ID, "top")
				value := processTopMetricValues(stats, metricField.(string))
				key := castToNullFloat(bucket.Get("key"))
				newSeries.Points = append(newSeries.Points, plugins.DataTimePoint{value, key})
			}

			for k, v := range props {
				newSeries.Tags[k] = v
			}
			newSeries.Tags["metric"] = "top_metrics"
			newSeries.Tags["field"] = metricField.(string)
			series = append(series, newSeries)
		}
	}
	return series
}
