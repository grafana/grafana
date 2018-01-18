package elasticsearch

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"

	"text/template"
)

// TemplateQueryModel provides the data container used by the elasticsearch JSON template
type TemplateQueryModel struct {
	TimeRange *tsdb.TimeRange
	Model     *RequestModel
}

var queryTemplate = `
{
	"size": 0,
	"query": {
		"filtered": {
			"query": {
				"query_string": {
					"analyze_wildcard": true,
					"query": {{ marshal .Model.Query }}
				}
			},
			"filter": {
				"bool": {
					"must": [
						{
							"range": {{ . | formatTimeRange }}
						}
					]
				}
			}
		}
	},
	"aggs": {{ . | formatAggregates }}
}`

func convertTimeToUnixNano(rangeTime string, now time.Time) string {
	if rangeTime == "now" {
		rangeTime = "30s"
	}

	duration, err := time.ParseDuration(fmt.Sprintf("-%s", rangeTime))
	if err != nil {
		return err.Error()
	}

	return strconv.FormatInt(now.Add(duration).UnixNano()/1000/1000, 10)
}

func formatTimeRange(data TemplateQueryModel) string {
	// to := convertTimeToUnixNano(data.TimeRange.To, data.TimeRange.now)
	// from := convertTimeToUnixNano(data.TimeRange.From, data.TimeRange.now)
	to := data.TimeRange.MustGetTo().UnixNano()
	from := data.TimeRange.MustGetFrom().UnixNano()

	return fmt.Sprintf(`
		{
			"%s": {
				"gte":"%s",
				"lte":"%s",
				"format":"epoch_millis"
			}
		}`, data.Model.TimeField, from, to)
}

func formatAggregates(data TemplateQueryModel) string {
	// Port of ElasticSearch query builder frontend datasource logic
	nestedAggs := simplejson.New()
	result := nestedAggs
	for _, bAgg := range data.Model.BucketAggregates {
		innerAgg := simplejson.New()
		switch bAgg.Type {
		case "date_histogram":
			innerAgg.Set("date_histogram", createDateHistogramAgg(&bAgg, data.TimeRange, data.Model.TimeField))
		case "filters":
			innerAgg.Set("filters", createFiltersAgg(&bAgg))
		case "terms":
			buildTermsAgg(&bAgg, innerAgg, data)
		case "geohash_grid":
			innerAgg.Set("geohash_grid", createGeohashAgg(&bAgg))
		}
		aggsVal, exists := nestedAggs.CheckGet("aggs")
		if !exists {
			aggsVal = simplejson.New()
			nestedAggs.Set("aggs", aggsVal)
		}
		aggsVal.Set(bAgg.ID, innerAgg)
		nestedAggs = innerAgg
	}

	innermostAggs := simplejson.New()
	nestedAggs.Set("aggs", innermostAggs)

	for _, metric := range data.Model.Metrics {
		if metric.Type == "count" {
			continue
		}

		aggField := simplejson.New()
		metricAgg := simplejson.New()

		if isPipelineAgg(metric.Type) {
			if pipelineAgg, err := strconv.Atoi(metric.PipelineAggregate); err == nil {
				metricAgg.Set("buckets_path", fmt.Sprintf("%d", pipelineAgg))
			} else {
				continue
			}
		} else {
			metricAgg.Set("field", metric.Field)
		}

		for setting, settingVal := range metric.Settings {
			metricAgg.Set(setting, settingVal)
		}

		aggField.Set(metric.Type, metricAgg)
		innermostAggs.Set(metric.ID, aggField)
	}

	aggString, err := result.Get("aggs").MarshalJSON()
	if err != nil {
		eslog.Error("%s %s\n", string(aggString), err.Error())
	}
	return string(aggString)
}

func _helperSetFieldInJsonFromMap(json *simplejson.Json, settingsMap map[string]interface{}, settingName string,
	defaultValue interface{}) {
	if val, exists := settingsMap[settingName]; exists {
		json.Set(settingName, val)
	} else if defaultValue != nil {
		json.Set(settingName, defaultValue)
	}
}

func createDateHistogramAgg(bAgg *BucketAggregate, timeRange *tsdb.TimeRange, defaultTimeField string) *simplejson.Json {
	result := simplejson.New()
	if bAgg.Settings != nil {
		_helperSetFieldInJsonFromMap(result, bAgg.Settings, "interval", nil)
		_helperSetFieldInJsonFromMap(result, bAgg.Settings, "min_doc_count", 0)
		_helperSetFieldInJsonFromMap(result, bAgg.Settings, "missing", nil)
	}

	result.Set("field", defaultTimeField)

	extendedBounds := simplejson.New()
	// extendedBounds.Set("min", convertTimeToUnixNano(timeRange.From, timeRange.now))
	// extendedBounds.Set("max", convertTimeToUnixNano(timeRange.To, timeRange.now))
	extendedBounds.Set("min", timeRange.MustGetFrom().UnixNano())
	extendedBounds.Set("max", timeRange.MustGetTo().UnixNano())
	result.Set("extended_bounds", extendedBounds)

	result.Set("format", "epoch_millis")

	if interval, _ := result.Get("interval").String(); interval == "auto" {
		calculator := tsdb.NewIntervalCalculator(&tsdb.IntervalOptions{})
		result.Set("interval", calculator.Calculate(timeRange, time.Millisecond*1).Text)
	}

	return result
}

func createFiltersAgg(bAgg *BucketAggregate) *simplejson.Json {
	result := simplejson.New()
	for _, filter := range bAgg.Settings["filters"].([]map[string]interface{}) {
		if query, exists := filter["query"]; exists {
			queryObjJson := simplejson.New()
			queryStringJson := simplejson.New()
			queryStringJson.Set("query", query)
			queryStringJson.Set("analyze_wildcard", true)
			queryObjJson.Set("query_string", queryStringJson)
			result.Set(query.(string), queryObjJson)
		}
	}
	return result
}

func buildTermsAgg(bAgg *BucketAggregate, queryNode *simplejson.Json, data TemplateQueryModel) {
	result := simplejson.New()
	result.Set("field", bAgg.Field)
	queryNode.Set("terms", result)

	if bAgg.Settings == nil {
		return
	}

	if size, err := strconv.Atoi(bAgg.Settings["size"].(string)); err == nil {
		if size == 0 {
			result.Set("size", 500)
		} else {
			result.Set("size", size)
		}
	}
	if orderBy, exists := bAgg.Settings["orderBy"]; exists {
		orderJson := simplejson.New()
		if order, exists := bAgg.Settings["order"]; exists {
			orderJson.Set(orderBy.(string), order)
		}
		result.Set("order", orderJson)

		_, err := strconv.Atoi(orderBy.(string))
		if err == nil {
			for _, metric := range data.Model.Metrics {
				if metric.ID == orderBy {
					aggJson := simplejson.New()
					queryNode.Set("aggs", aggJson)
					metricAggJson := simplejson.New()
					metricAggJson.Set("field", metric.Field)
					aggJson.Set(metric.Type, metricAggJson)
					break
				}
			}
		}

		_helperSetFieldInJsonFromMap(result, bAgg.Settings, "min_doc_count", nil)
		_helperSetFieldInJsonFromMap(result, bAgg.Settings, "missing", nil)
	}
}

func createGeohashAgg(bAgg *BucketAggregate) *simplejson.Json {
	geohashJson := simplejson.New()
	geohashJson.Set("field", bAgg.Field)
	geohashJson.Set("precision", bAgg.Settings["precision"])
	return geohashJson
}

func isPipelineAgg(metricType string) bool {
	// Taken from pipeline options in the Elasticsearch query definition
	switch metricType {
	case "moving_avg", "derivative":
		return true
	}
	return false
}

func (model *RequestModel) buildQueryJSON(timeRange *tsdb.TimeRange) (string, error) {

	templateQueryModel := TemplateQueryModel{
		TimeRange: timeRange,
		Model:     model,
	}

	funcMap := template.FuncMap{
		"formatTimeRange":  formatTimeRange,
		"formatAggregates": formatAggregates,
		"marshal": func(v interface{}) string {
			a, _ := json.Marshal(v)
			return string(a)
		},
	}

	t, err := template.New("elasticsearchQuery").Funcs(funcMap).Parse(queryTemplate)
	if err != nil {
		return "", err
	}

	buffer := bytes.NewBufferString("")
	t.Execute(buffer, templateQueryModel)

	return string(buffer.Bytes()), nil
}
