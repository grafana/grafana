package elasticsearch

import (
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"strconv"
	"regexp"
	"strings"
)

type ElasticsearchResponseParser struct {
	Responses []Response
	Targets   []*QueryBuilder
}

func (rp *ElasticsearchResponseParser) getTimeSeries() *tsdb.QueryResult {
	queryRes := tsdb.NewQueryResult()
	for i, res := range rp.Responses {
		target := rp.Targets[i]
		props := make(map[string]string)
		series := make([]*tsdb.TimeSeries, 0)
		rp.processBuckets(res.Aggregations, target, &series, props, 0)
		rp.nameSeries(&series, target)
		queryRes.Series = append(queryRes.Series, series...)
	}
	return queryRes
}

func (rp *ElasticsearchResponseParser) processBuckets(aggs map[string]interface{}, target *QueryBuilder, series *[]*tsdb.TimeSeries, props map[string]string, depth int) (error) {
	var err error
	maxDepth := len(target.BucketAggs) - 1
	for aggId, v := range aggs {
		aggDef, _ := findAgg(target, aggId)
		esAgg := simplejson.NewFromAny(v)
		if aggDef == nil {
			continue
		}

		if depth == maxDepth {
			if aggDef.Get("type").MustString() == "date_histogram" {
				err = rp.processMetrics(esAgg, target, series, props)
				if err != nil {
					return err
				}
			} else {
				return fmt.Errorf("not support type:%s", aggDef.Get("type").MustString())
			}
		} else {
			for i, b := range esAgg.Get("buckets").MustArray() {
				field := aggDef.Get("field").MustString()
				bucket := simplejson.NewFromAny(b)
				newProps := props
				if key, err := bucket.Get("key").String(); err == nil {
					newProps[field] = key
				} else {
					props["filter"] = strconv.Itoa(i)
				}

				if key, err := bucket.Get("key_as_string").String(); err == nil {
					props[field] = key
				}
				rp.processBuckets(bucket.MustMap(), target, series, newProps, depth+1)
			}
		}

	}
	return nil

}

func (rp *ElasticsearchResponseParser) processMetrics(esAgg *simplejson.Json, target *QueryBuilder, series *[]*tsdb.TimeSeries, props map[string]string) (error) {
	for _, v := range target.Metrics {
		metric := simplejson.NewFromAny(v)
		if metric.Get("hide").MustBool(false) {
			continue
		}

		metricId := metric.Get("id").MustString()
		metricField := metric.Get("field").MustString()
		metricType := metric.Get("type").MustString()

		switch metricType {
		case "count":
			newSeries := tsdb.TimeSeries{}
			for _, v := range esAgg.Get("buckets").MustArray() {
				bucket := simplejson.NewFromAny(v)
				value := castToNullFloat(bucket.Get("doc_count"))
				key := castToNullFloat(bucket.Get("key"))
				newSeries.Points = append(newSeries.Points, tsdb.TimePoint{value, key})
			}
			newSeries.Tags = props
			newSeries.Tags["metric"] = "count"
			*series = append(*series, &newSeries)

		case "percentiles":
			buckets := esAgg.Get("buckets").MustArray()
			if len(buckets) == 0 {
				break
			}

			firstBucket := simplejson.NewFromAny(buckets[0])
			percentiles := firstBucket.GetPath(metricId, "values").MustMap()

			for percentileName := range percentiles {
				newSeries := tsdb.TimeSeries{}
				newSeries.Tags = props
				newSeries.Tags["metric"] = "p" + percentileName
				newSeries.Tags["field"] = metricField
				for _, v := range buckets {
					bucket := simplejson.NewFromAny(v)
					value := castToNullFloat(bucket.GetPath(metricId, "values", percentileName))
					key := castToNullFloat(bucket.Get("key"))
					newSeries.Points = append(newSeries.Points, tsdb.TimePoint{value, key})
				}
				*series = append(*series, &newSeries)
			}
		default:
			newSeries := tsdb.TimeSeries{}
			newSeries.Tags = props
			newSeries.Tags["metric"] = metricType
			newSeries.Tags["field"] = metricField
			for _, v := range esAgg.Get("buckets").MustArray() {
				bucket := simplejson.NewFromAny(v)
				key := castToNullFloat(bucket.Get("key"))
				valueObj, err := bucket.Get(metricId).Map()
				if err != nil {
					break
				}
				var value null.Float
				if _, ok := valueObj["normalized_value"]; ok {
					value = castToNullFloat(bucket.GetPath(metricId, "normalized_value"))
				} else {
					value = castToNullFloat(bucket.GetPath(metricId, "value"))
				}
				newSeries.Points = append(newSeries.Points, tsdb.TimePoint{value, key})
			}
			*series = append(*series, &newSeries)
		}
	}
	return nil
}

func (rp *ElasticsearchResponseParser) nameSeries(seriesList *[]*tsdb.TimeSeries, target *QueryBuilder) {
	set := make(map[string]string)
	for _, v := range *seriesList {
		if metricType, exists := v.Tags["metric"]; exists {
			if _, ok := set[metricType]; !ok {
				set[metricType] = ""
			}
		}
	}
	metricTypeCount := len(set)
	for _, series := range *seriesList {
		series.Name = rp.getSeriesName(series, target, metricTypeCount)
	}

}

func (rp *ElasticsearchResponseParser) getSeriesName(series *tsdb.TimeSeries, target *QueryBuilder, metricTypeCount int) (string) {
	metricName := rp.getMetricName(series.Tags["metric"])
	delete(series.Tags, "metric")

	field := ""
	if v, ok := series.Tags["field"]; ok {
		field = v
		delete(series.Tags, "field")
	}

	if target.Alias != "" {
		var re = regexp.MustCompile(`{{([\s\S]+?)}}`)
		for _, match := range re.FindAllString(target.Alias, -1) {
			group := match[2:len(match)-2]

			if strings.HasPrefix(group, "term ") {
				if term, ok := series.Tags["term "]; ok {
					strings.Replace(target.Alias, match, term, 1)
				}
			}
			if v, ok := series.Tags[group]; ok {
				strings.Replace(target.Alias, match, v, 1)
			}

			switch group {
			case "metric":
				strings.Replace(target.Alias, match, metricName, 1)
			case "field":
				strings.Replace(target.Alias, match, field, 1)
			}

		}
	}
	// todo, if field and pipelineAgg
	if field != "" {
		metricName += " " + field
	}

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

func (rp *ElasticsearchResponseParser) getMetricName(metric string) string {
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

	s, err := j.String()
	if err == nil {
		v, _ := strconv.ParseFloat(s, 64)
		return null.FloatFromPtr(&v)
	}

	return null.NewFloat(0, false)
}

func findAgg(target *QueryBuilder, aggId string) (*simplejson.Json, error) {
	for _, v := range target.BucketAggs {
		aggDef := simplejson.NewFromAny(v)
		if aggId == aggDef.Get("id").MustString() {
			return aggDef, nil
		}
	}
	return nil, errors.New("can't found aggDef, aggID:" + aggId)
}
