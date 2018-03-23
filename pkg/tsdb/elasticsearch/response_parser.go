package elasticsearch

import (
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"strconv"
)

type ElasticsearchResponseParser struct {
	Responses []Response
	Targets   []QueryBuilder
}

func (rp *ElasticsearchResponseParser) getTimeSeries() []interface{} {
	for i, res := range rp.Responses {
		var series []interface{}
		target := rp.Targets[i]
		props := make(map[string]interface{})
		rp.processBuckets(res.Aggregations, target, &series, props, 0)
	}
}

func findAgg(target QueryBuilder, aggId string) (*simplejson.Json, error) {
	for _, v := range target.BucketAggs {
		aggDef := simplejson.NewFromAny(v)
		if aggId == aggDef.Get("id").MustString() {
			return aggDef, nil
		}
	}
	return nil, errors.New("can't found aggDef, aggID:" + aggId)
}

func (rp *ElasticsearchResponseParser) processBuckets(aggs map[string]interface{}, target QueryBuilder, series *[]interface{}, props map[string]interface{}, depth int) error {
	maxDepth := len(target.BucketAggs) - 1
	for aggId, v := range aggs {
		aggDef, _ := findAgg(target, aggId)
		esAgg := simplejson.NewFromAny(v)
		if aggDef == nil {
			continue
		}

		if depth == maxDepth {
			if aggDef.Get("type").MustString() == "date_histogram" {
				rp.processMetrics(esAgg, target, series, props)
			}
		}

	}

}

func mapCopy(originalMap, newMap *map[string]string) {
	for k, v := range originalMap {
		newMap[k] = v
	}

}

func (rp *ElasticsearchResponseParser) processMetrics(esAgg *simplejson.Json, target QueryBuilder, props map[string]string) ([]*tsdb.TimeSeries, error) {
	var series []*tsdb.TimeSeries
	for _, v := range target.Metrics {
		metric := simplejson.NewFromAny(v)
		if metric.Get("hide").MustBool(false) {
			continue
		}
		metricId := fmt.Sprintf("%d", metric.Get("id").MustInt())
		metricField := metric.Get("field").MustString()

		switch metric.Get("type").MustString() {
		case "count":
			newSeries := tsdb.TimeSeries{}
			for _, v := range esAgg.Get("buckets").MustMap() {
				bucket := simplejson.NewFromAny(v)
				value := bucket.Get("doc_count").MustFloat64()
				key := bucket.Get("key").MustFloat64()
				newSeries.Points = append(newSeries.Points, tsdb.TimePoint{null.FloatFromPtr(&value), null.FloatFromPtr(&key)})
			}
			newSeries.Tags = props
			newSeries.Tags["metric"] = "count"
			series = append(series, &newSeries)

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
					valueStr := bucket.GetPath(metricId, "values", percentileName).MustString()
					value, _ := strconv.ParseFloat(valueStr, 64)
					key := bucket.Get("key").MustFloat64()
					newSeries.Points = append(newSeries.Points, tsdb.TimePoint{null.FloatFromPtr(&value), null.FloatFromPtr(&key)})
				}
				series = append(series, &newSeries)
			}
		}
	}
	return series
}
