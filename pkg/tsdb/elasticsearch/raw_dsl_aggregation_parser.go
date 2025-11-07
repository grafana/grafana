package elasticsearch

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

// AggregationParser parses raw Elasticsearch DSL aggregations
type AggregationParser interface {
	Parse(rawQuery string) ([]*BucketAgg, []*MetricAgg, error)
}

// aggregationTypeParser handles parsing of specific aggregation types
type aggregationTypeParser interface {
	CanParse(aggType string) bool
	Parse(id, aggType string, aggValue map[string]any) (*dsa, error)
}

type dsa struct {
	b BucketAgg
	m MetricAgg
}

// fieldExtractor handles extracting and converting field values
type fieldExtractor struct{}

func (e *fieldExtractor) getString(data map[string]any, key string) string {
	if val, ok := data[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

func (e *fieldExtractor) getInt(data map[string]any, key string) int {
	if val, ok := data[key]; ok {
		switch v := val.(type) {
		case float64:
			return int(v)
		case int:
			return v
		case string:
			if i, err := strconv.Atoi(v); err == nil {
				return i
			}
		}
	}
	return 0
}

func (e *fieldExtractor) getFloat(data map[string]any, key string) float64 {
	if val, ok := data[key]; ok {
		switch v := val.(type) {
		case float64:
			return v
		case int:
			return float64(v)
		case string:
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				return f
			}
		}
	}
	return 0
}

func (e *fieldExtractor) getBool(data map[string]any, key string) bool {
	if val, ok := data[key]; ok {
		if b, ok := val.(bool); ok {
			return b
		}
	}
	return false
}

func (e *fieldExtractor) getMap(data map[string]any, key string) map[string]any {
	if val, ok := data[key]; ok {
		if m, ok := val.(map[string]any); ok {
			return m
		}
	}
	return nil
}

func (e *fieldExtractor) getSettings(data map[string]any) *simplejson.Json {
	settings := make(map[string]any)
	for k, v := range data {
		// Skip known non-setting fields
		if k == "field" || k == "buckets_path" {
			continue
		}
		settings[k] = v
	}
	return simplejson.NewFromAny(settings)
}

// dateHistogramParser handles date_histogram aggregations
type dateHistogramParser struct {
	extractor *fieldExtractor
}

func (p *dateHistogramParser) CanParse(aggType string) bool {
	return aggType == dateHistType
}

func (p *dateHistogramParser) Parse(id, aggType string, aggValue map[string]any) (*dsa, error) {
	field := p.extractor.getString(aggValue, "field")

	settings := make(map[string]any)
	if interval := p.extractor.getString(aggValue, "fixed_interval"); interval != "" {
		settings["interval"] = interval
	} else if interval := p.extractor.getString(aggValue, "calendar_interval"); interval != "" {
		settings["interval"] = interval
	} else if interval := p.extractor.getString(aggValue, "interval"); interval != "" {
		settings["interval"] = interval
	}

	if minDocCount := p.extractor.getInt(aggValue, "min_doc_count"); minDocCount > 0 {
		settings["min_doc_count"] = strconv.Itoa(minDocCount)
	}

	if timeZone := p.extractor.getString(aggValue, "time_zone"); timeZone != "" {
		settings["time_zone"] = timeZone
	}

	return &dsa{b: BucketAgg{
		ID:       id,
		Type:     dateHistType,
		Field:    field,
		Settings: simplejson.NewFromAny(settings),
	}}, nil
}

// termsParser handles terms aggregations
type termsParser struct {
	extractor *fieldExtractor
}

func (p *termsParser) CanParse(aggType string) bool {
	return aggType == termsType
}

func (p *termsParser) ParseBucket(id, aggType string, aggValue map[string]any) (*BucketAgg, error) {
	field := p.extractor.getString(aggValue, "field")

	settings := make(map[string]any)
	if size := p.extractor.getInt(aggValue, "size"); size > 0 {
		settings["size"] = strconv.Itoa(size)
	}

	if order := p.extractor.getMap(aggValue, "order"); order != nil {
		orderJSON, _ := json.Marshal(order)
		settings["order"] = string(orderJSON)
	}

	if missing := p.extractor.getString(aggValue, "missing"); missing != "" {
		settings["missing"] = missing
	}

	return &BucketAgg{
		ID:       id,
		Type:     termsType,
		Field:    field,
		Settings: simplejson.NewFromAny(settings),
	}, nil
}

// histogramParser handles histogram aggregations
type histogramParser struct {
	extractor *fieldExtractor
}

func (p *histogramParser) CanParse(aggType string) bool {
	return aggType == histogramType
}

func (p *histogramParser) ParseBucket(id, aggType string, aggValue map[string]any) (*BucketAgg, error) {
	field := p.extractor.getString(aggValue, "field")

	settings := make(map[string]any)
	if interval := p.extractor.getFloat(aggValue, "interval"); interval > 0 {
		settings["interval"] = strconv.FormatFloat(interval, 'f', -1, 64)
	}

	if minDocCount := p.extractor.getInt(aggValue, "min_doc_count"); minDocCount > 0 {
		settings["min_doc_count"] = strconv.Itoa(minDocCount)
	}

	return &BucketAgg{
		ID:       id,
		Type:     histogramType,
		Field:    field,
		Settings: simplejson.NewFromAny(settings),
	}, nil
}

// simpleMetricParser handles simple metric aggregations (avg, sum, min, max, cardinality)
type simpleMetricParser struct {
	extractor *fieldExtractor
	types     map[string]bool
}

func newSimpleMetricParser() *simpleMetricParser {
	return &simpleMetricParser{
		extractor: &fieldExtractor{},
		types: map[string]bool{
			"avg":         true,
			"sum":         true,
			"min":         true,
			"max":         true,
			"cardinality": true,
		},
	}
}

func (p *simpleMetricParser) CanParse(aggType string) bool {
	return p.types[aggType]
}

func (p *simpleMetricParser) ParseMetric(id, aggType string, aggValue map[string]any) (*MetricAgg, error) {
	field := p.extractor.getString(aggValue, "field")
	settings := p.extractor.getSettings(aggValue)

	return &MetricAgg{
		ID:       id,
		Type:     aggType,
		Field:    field,
		Settings: settings,
	}, nil
}

// filtersParser handles filters aggregations
type filtersParser struct {
	extractor *fieldExtractor
}

func (p *filtersParser) CanParse(aggType string) bool {
	return aggType == filtersType
}

func (p *filtersParser) ParseBucket(id, aggType string, aggValue map[string]any) (*BucketAgg, error) {
	settings := make(map[string]any)

	if filters := p.extractor.getMap(aggValue, "filters"); filters != nil {
		filtersJSON, _ := json.Marshal(filters)
		settings["filters"] = string(filtersJSON)
	}

	return &BucketAgg{
		ID:       id,
		Type:     filtersType,
		Field:    "",
		Settings: simplejson.NewFromAny(settings),
	}, nil
}

// geohashGridParser handles geohash_grid aggregations
type geohashGridParser struct {
	extractor *fieldExtractor
}

func (p *geohashGridParser) CanParse(aggType string) bool {
	return aggType == geohashGridType
}

func (p *geohashGridParser) ParseBucket(id, aggType string, aggValue map[string]any) (*BucketAgg, error) {
	field := p.extractor.getString(aggValue, "field")

	settings := make(map[string]any)
	if precision := p.extractor.getInt(aggValue, "precision"); precision > 0 {
		settings["precision"] = strconv.Itoa(precision)
	}

	return &BucketAgg{
		ID:       id,
		Type:     geohashGridType,
		Field:    field,
		Settings: simplejson.NewFromAny(settings),
	}, nil
}

// nestedParser handles nested aggregations
type nestedParser struct {
	extractor *fieldExtractor
}

func (p *nestedParser) CanParse(aggType string) bool {
	return aggType == nestedType
}

func (p *nestedParser) ParseBucket(id, aggType string, aggValue map[string]any) (*BucketAgg, error) {
	path := p.extractor.getString(aggValue, "path")

	return &BucketAgg{
		ID:       id,
		Type:     nestedType,
		Field:    path,
		Settings: simplejson.NewFromAny(map[string]any{}),
	}, nil
}

// extendedStatsParser handles extended_stats aggregations
type extendedStatsParser struct {
	extractor *fieldExtractor
}

func (p *extendedStatsParser) CanParse(aggType string) bool {
	return aggType == extendedStatsType
}

func (p *extendedStatsParser) ParseMetric(id, aggType string, aggValue map[string]any) (*MetricAgg, error) {
	field := p.extractor.getString(aggValue, "field")
	settings := p.extractor.getSettings(aggValue)

	return &MetricAgg{
		ID:       id,
		Type:     extendedStatsType,
		Field:    field,
		Settings: settings,
	}, nil
}

// percentilesParser handles percentiles aggregations
type percentilesParser struct {
	extractor *fieldExtractor
}

func (p *percentilesParser) CanParse(aggType string) bool {
	return aggType == percentilesType
}

func (p *percentilesParser) ParseMetric(id, aggType string, aggValue map[string]any) (*MetricAgg, error) {
	field := p.extractor.getString(aggValue, "field")
	settings := p.extractor.getSettings(aggValue)

	return &MetricAgg{
		ID:       id,
		Type:     percentilesType,
		Field:    field,
		Settings: settings,
	}, nil
}

// topMetricsParser handles top_metrics aggregations
type topMetricsParser struct {
	extractor *fieldExtractor
}

func (p *topMetricsParser) CanParse(aggType string) bool {
	return aggType == topMetricsType
}

func (p *topMetricsParser) ParseMetric(id, aggType string, aggValue map[string]any) (*MetricAgg, error) {
	settings := p.extractor.getSettings(aggValue)

	// Extract metrics field if present
	field := ""
	if metrics := p.extractor.getMap(aggValue, "metrics"); metrics != nil {
		if metricsField := p.extractor.getString(metrics, "field"); metricsField != "" {
			field = metricsField
		}
	}

	return &MetricAgg{
		ID:       id,
		Type:     topMetricsType,
		Field:    field,
		Settings: settings,
	}, nil
}

// pipelineParser handles pipeline aggregations
type pipelineParser struct {
	extractor *fieldExtractor
	types     map[string]bool
}

func newPipelineParser() *pipelineParser {
	return &pipelineParser{
		extractor: &fieldExtractor{},
		types: map[string]bool{
			"moving_avg":     true,
			"moving_fn":      true,
			"derivative":     true,
			"cumulative_sum": true,
			"serial_diff":    true,
		},
	}
}

func (p *pipelineParser) CanParse(aggType string) bool {
	return p.types[aggType]
}

func (p *pipelineParser) ParseMetric(id, aggType string, aggValue map[string]any) (*MetricAgg, error) {
	bucketsPath := p.extractor.getString(aggValue, "buckets_path")
	settings := p.extractor.getSettings(aggValue)

	return &MetricAgg{
		ID:       id,
		Type:     aggType,
		Field:    bucketsPath, // For pipeline aggs, buckets_path goes in Field
		Settings: settings,
	}, nil
}

// bucketScriptParser handles bucket_script aggregations
type bucketScriptParser struct {
	extractor *fieldExtractor
}

func (p *bucketScriptParser) CanParse(aggType string) bool {
	return aggType == "bucket_script"
}

func (p *bucketScriptParser) ParseMetric(id, aggType string, aggValue map[string]any) (*MetricAgg, error) {
	settings := p.extractor.getSettings(aggValue)

	// Extract buckets_path (can be a string or map)
	pipelineVariables := make(map[string]string)
	if bucketsPath, ok := aggValue["buckets_path"]; ok {
		switch bp := bucketsPath.(type) {
		case string:
			// Single string bucket path
			pipelineVariables["var1"] = bp
		case map[string]any:
			// Map of variable names to bucket paths
			for varName, path := range bp {
				if pathStr, ok := path.(string); ok {
					pipelineVariables[varName] = pathStr
				}
			}
		}
	}

	return &MetricAgg{
		ID:                id,
		Type:              "bucket_script",
		Field:             "",
		PipelineVariables: pipelineVariables,
		Settings:          settings,
	}, nil
}

// compositeParser combines multiple parsers
type compositeParser struct {
	parsers   []aggregationTypeParser
	extractor *fieldExtractor
}

func newCompositeParser() *compositeParser {
	extractor := &fieldExtractor{}
	return &compositeParser{
		extractor: extractor,
		parsers: []aggregationTypeParser{
			// Bucket aggregations
			&dateHistogramParser{extractor: extractor},
			&termsParser{extractor: extractor},
			&histogramParser{extractor: extractor},
			&filtersParser{extractor: extractor},
			&geohashGridParser{extractor: extractor},
			&nestedParser{extractor: extractor},
			// Metric aggregations
			newSimpleMetricParser(),
			&extendedStatsParser{extractor: extractor},
			&percentilesParser{extractor: extractor},
			&topMetricsParser{extractor: extractor},

			// Pipeline aggregations
			newPipelineParser(),
			&bucketScriptParser{extractor: extractor},
		},
	}
}

func (p *compositeParser) findParser(aggType string) aggregationTypeParser {
	for _, parser := range p.parsers {
		if parser.CanParse(aggType) {
			return parser
		}
	}
	return nil
}

func (p *compositeParser) Parse(rawQuery string) ([]*BucketAgg, []*MetricAgg, error) {
	if rawQuery == "" {
		return nil, nil, nil
	}

	var queryBody map[string]any
	if err := json.Unmarshal([]byte(rawQuery), &queryBody); err != nil {
		return nil, nil, fmt.Errorf("failed to parse raw query JSON: %w", err)
	}

	// Look for aggregations in both "aggs" and "aggregations"
	var aggsData map[string]any
	if aggs, ok := queryBody["aggs"].(map[string]any); ok {
		aggsData = aggs
	} else if aggs, ok := queryBody["aggregations"].(map[string]any); ok {
		aggsData = aggs
	}

	if aggsData == nil {
		return nil, nil, nil
	}

	return p.parseAggregations(aggsData)
}

func (p *compositeParser) parseAggregations(aggsData map[string]any) ([]*BucketAgg, []*MetricAgg, error) {
	var bucketAggs []*BucketAgg
	var metricAggs []*MetricAgg

	for aggID, aggData := range aggsData {
		aggMap, ok := aggData.(map[string]any)
		if !ok {
			continue
		}

		// Find the aggregation type (first key that's not "aggs" or "aggregations")
		var aggType string
		var aggValue map[string]any
		for key, value := range aggMap {
			if key != "aggs" && key != "aggregations" {
				aggType = key
				if val, ok := value.(map[string]any); ok {
					aggValue = val
				}
				break
			}
		}

		if aggType == "" || aggValue == nil {
			continue
		}

		// Find the appropriate parser for this aggregation type
		parser := p.findParser(aggType)
		if parser == nil {
			// Unknown aggregation type, skip it
			continue
		}

		// Try to parse as bucket aggregation
		if bucket, err := parser.ParseBucket(aggID, aggType, aggValue); err == nil && bucket != nil {
			bucketAggs = append(bucketAggs, bucket)
		}

		// Try to parse as metric aggregation
		if metric, err := parser.ParseMetric(aggID, aggType, aggValue); err == nil && metric != nil {
			metricAggs = append(metricAggs, metric)
		}

		// Parse nested aggregations
		if nestedAggs := p.extractor.getMap(aggMap, "aggs"); nestedAggs != nil {
			nestedBuckets, nestedMetrics, _ := p.parseAggregations(nestedAggs)
			bucketAggs = append(bucketAggs, nestedBuckets...)
			metricAggs = append(metricAggs, nestedMetrics...)
		} else if nestedAggs := p.extractor.getMap(aggMap, "aggregations"); nestedAggs != nil {
			nestedBuckets, nestedMetrics, _ := p.parseAggregations(nestedAggs)
			bucketAggs = append(bucketAggs, nestedBuckets...)
			metricAggs = append(metricAggs, nestedMetrics...)
		}
	}

	return bucketAggs, metricAggs, nil
}

// NewAggregationParser creates a new aggregation parser
func NewAggregationParser() AggregationParser {
	return newCompositeParser()
}
