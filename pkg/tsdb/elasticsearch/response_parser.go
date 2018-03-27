package elasticsearch

import (
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"regexp"
	"strconv"
	"strings"
)

type ElasticsearchResponseParser struct {
	Responses []Response
	Targets   []*Query
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

func (rp *ElasticsearchResponseParser) processBuckets(aggs map[string]interface{}, target *Query, series *[]*tsdb.TimeSeries, props map[string]string, depth int) error {
	var err error
	maxDepth := len(target.BucketAggs) - 1
	for aggId, v := range aggs {
		aggDef, _ := findAgg(target, aggId)
		esAgg := simplejson.NewFromAny(v)
		if aggDef == nil {
			continue
		}

		if depth == maxDepth {
			if aggDef.Type == "date_histogram" {
				err = rp.processMetrics(esAgg, target, series, props)
				if err != nil {
					return err
				}
			} else {
				return fmt.Errorf("not support type:%s", aggDef.Type)
			}
		} else {
			for i, b := range esAgg.Get("buckets").MustArray() {
				bucket := simplejson.NewFromAny(b)
				newProps := props
				if key, err := bucket.Get("key").String(); err == nil {
					newProps[aggDef.Field] = key
				} else {
					props["filter"] = strconv.Itoa(i)
				}

				if key, err := bucket.Get("key_as_string").String(); err == nil {
					props[aggDef.Field] = key
				}
				rp.processBuckets(bucket.MustMap(), target, series, newProps, depth+1)
			}
		}

	}
	return nil

}

func (rp *ElasticsearchResponseParser) processMetrics(esAgg *simplejson.Json, target *Query, series *[]*tsdb.TimeSeries, props map[string]string) error {
	for _, metric := range target.Metrics {
		if metric.Hide {
			continue
		}

		switch metric.Type {
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
			percentiles := firstBucket.GetPath(metric.ID, "values").MustMap()

			for percentileName := range percentiles {
				newSeries := tsdb.TimeSeries{}
				newSeries.Tags = props
				newSeries.Tags["metric"] = "p" + percentileName
				newSeries.Tags["field"] = metric.Field
				for _, v := range buckets {
					bucket := simplejson.NewFromAny(v)
					value := castToNullFloat(bucket.GetPath(metric.ID, "values", percentileName))
					key := castToNullFloat(bucket.Get("key"))
					newSeries.Points = append(newSeries.Points, tsdb.TimePoint{value, key})
				}
				*series = append(*series, &newSeries)
			}
		default:
			newSeries := tsdb.TimeSeries{}
			newSeries.Tags = props
			newSeries.Tags["metric"] = metric.Type
			newSeries.Tags["field"] = metric.Field
			for _, v := range esAgg.Get("buckets").MustArray() {
				bucket := simplejson.NewFromAny(v)
				key := castToNullFloat(bucket.Get("key"))
				valueObj, err := bucket.Get(metric.ID).Map()
				if err != nil {
					break
				}
				var value null.Float
				if _, ok := valueObj["normalized_value"]; ok {
					value = castToNullFloat(bucket.GetPath(metric.ID, "normalized_value"))
				} else {
					value = castToNullFloat(bucket.GetPath(metric.ID, "value"))
				}
				newSeries.Points = append(newSeries.Points, tsdb.TimePoint{value, key})
			}
			*series = append(*series, &newSeries)
		}
	}
	return nil
}

func (rp *ElasticsearchResponseParser) nameSeries(seriesList *[]*tsdb.TimeSeries, target *Query) {
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

func (rp *ElasticsearchResponseParser) getSeriesName(series *tsdb.TimeSeries, target *Query, metricTypeCount int) string {
	metricType := series.Tags["metric"]
	metricName := rp.getMetricName(metricType)
	delete(series.Tags, "metric")

	field := ""
	if v, ok := series.Tags["field"]; ok {
		field = v
		delete(series.Tags, "field")
	}

	if target.Alias != "" {
		var re = regexp.MustCompile(`{{([\s\S]+?)}}`)
		for _, match := range re.FindAllString(target.Alias, -1) {
			group := match[2 : len(match)-2]

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
	if field != "" && isPipelineAgg(metricType) {
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

	} else if field != "" {
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

func findAgg(target *Query, aggId string) (*BucketAgg, error) {
	for _, v := range target.BucketAggs {
		if aggId == v.ID {
			return v, nil
		}
	}
	return nil, errors.New("can't found aggDef, aggID:" + aggId)
}
