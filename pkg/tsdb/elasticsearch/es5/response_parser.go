package es5

import (
	"fmt"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/models"
	"github.com/pkg/errors"
	"gopkg.in/olivere/elastic.v5"
)

var (
	InstanceESResponseParser = &ESResponseParser{}
)

type ESResponseParser struct{}

func (p *ESResponseParser) Parse(query *tsdb.Query, resp *elastic.MultiSearchResult) (result *tsdb.QueryResult, err error) {
	result = tsdb.NewQueryResult()
	if len(resp.Responses) <= 0 {
		return nil, errors.New("no response")
	}
	r := resp.Responses[0]

	metrics, err := query.Model.Get(models.MetricKey).Array()
	if err != nil {
		return nil, err
	}

	allBuckets := parseAggregations(query, r)

	for key, buckets := range allBuckets {

		for _, m := range metrics {
			metric := simplejson.NewFromAny(m)
			result.Series = append(result.Series, parseMetricResponse(key, metric, buckets)...)
		}
	}

	return result, nil
}

type BucketList []*Bucket

type Bucket struct {
	elastic.Aggregations

	Key         float64
	KeyAsString string
	DocCount    int64
}

func parseAggregations(query *tsdb.Query, resp *elastic.SearchResult) map[string]BucketList {
	bucketAggs := query.Model.Get(models.BucketAggsKey).MustArray()
	lastResult := map[string]BucketList{}
	lastResult[""] = BucketList{
		&Bucket{
			Aggregations: resp.Aggregations,
		}}
	for _, bagg := range bucketAggs {
		baggJson := simplejson.NewFromAny(bagg)
		t, err := baggJson.Get(models.TypeKey).String()
		if err != nil {
			continue
		}
		id, err := baggJson.Get(models.IdKey).String()
		if err != nil {
			continue
		}
		switch t {
		case models.AggTypeTerms:
			lastResult = parseTermsAggregations(id, lastResult)
		case models.AggTypeFilters:
			lastResult = parseFiltersAggregations(id, lastResult)
		case models.AggTypeHistogram:
			lastResult = parseHistogramAggregations(id, lastResult)
		case models.AggTypeGeoHashGrid:
			lastResult = parseGeoHashGridAggregations(id, lastResult)
		case models.AggTypeDateHistogram:
			lastResult = parseDateHistogramAggregations(id, lastResult)
		}
	}
	result := map[string]BucketList{}
	for _, buckets := range lastResult {
		for _, b := range buckets {
			_, succ := result[b.KeyAsString]
			if !succ {
				result[b.KeyAsString] = BucketList{}
			}
			result[b.KeyAsString] = append(result[b.KeyAsString], b)
		}
	}
	return result

}
func parseGeoHashGridAggregations(id string, lastResult map[string]BucketList) map[string]BucketList {
	currResult := map[string]BucketList{}
	for _, aggs := range lastResult {
		for _, agg := range aggs {
			parentName := agg.KeyAsString
			terms, succ := agg.GeoHash(id)
			if !succ {
				continue
			}
			for _, bucket := range terms.Buckets {
				childKey := fmt.Sprintf("%v", bucket.Key)
				currResult[id] = append(currResult[id], &Bucket{
					KeyAsString:  parentName + " " + childKey,
					Aggregations: bucket.Aggregations,
					DocCount:     bucket.DocCount,
				})
			}
		}
	}
	return currResult
}

func parseTermsAggregations(id string, lastResult map[string]BucketList) map[string]BucketList {
	currResult := map[string]BucketList{}
	for _, aggs := range lastResult {
		for _, agg := range aggs {
			parentName := agg.KeyAsString
			terms, succ := agg.Terms(id)
			if !succ {
				continue
			}
			for _, bucket := range terms.Buckets {
				childKey := fmt.Sprintf("%v", bucket.Key)
				currResult[id] = append(currResult[id], &Bucket{
					KeyAsString:  parentName + " " + childKey,
					Aggregations: bucket.Aggregations,
					DocCount:     bucket.DocCount,
				})
			}
		}
	}
	return currResult
}

func parseHistogramAggregations(id string, lastResult map[string]BucketList) map[string]BucketList {
	currResult := map[string]BucketList{}
	for _, aggs := range lastResult {
		for _, agg := range aggs {
			parentName := agg.KeyAsString
			terms, succ := agg.Histogram(id)
			if !succ {
				continue
			}
			for _, bucket := range terms.Buckets {
				childKey := fmt.Sprintf("%v", bucket.Key)
				currResult[id] = append(currResult[id], &Bucket{
					KeyAsString:  parentName + " " + childKey,
					Aggregations: bucket.Aggregations,
					DocCount:     bucket.DocCount,
				})
			}
		}
	}
	return currResult
}

func parseFiltersAggregations(id string, lastResult map[string]BucketList) map[string]BucketList {
	currResult := map[string]BucketList{}
	for _, aggs := range lastResult {
		for _, agg := range aggs {
			parentName := agg.KeyAsString
			terms, succ := agg.Filters(id)
			if !succ {
				continue
			}

			for childKey, bucket := range terms.NamedBuckets {
				currResult[id] = append(currResult[id], &Bucket{
					KeyAsString:  parentName + " " + childKey,
					Aggregations: bucket.Aggregations,
					DocCount:     bucket.DocCount,
				})
			}
		}
	}
	return currResult
}

func parseDateHistogramAggregations(id string, lastResult map[string]BucketList) map[string]BucketList {
	currResult := map[string]BucketList{}
	for _, aggs := range lastResult {
		for _, agg := range aggs {
			parentName := agg.KeyAsString
			terms, succ := agg.DateHistogram(id)
			if !succ {
				continue
			}
			for _, bucket := range terms.Buckets {
				currResult[id] = append(currResult[id], &Bucket{
					KeyAsString:  parentName,
					Aggregations: bucket.Aggregations,
					DocCount:     bucket.DocCount,
				})
			}
		}
	}
	return currResult
}

var (
	instanceCountResponseMetricParser       = &countResponseMetricParser{}
	instanceAvgResponseMetricParser         = &avgResponseMetricParser{}
	instanceSumResponseMetricParser         = &sumResponseMetricParser{}
	instanceMaxResponseMetricParser         = &maxResponseMetricParser{}
	instanceMinResponseMetricParser         = &minResponseMetricParser{}
	instanceStatsResponseMetricParser       = &statsResponseMetricParser{}
	instancePercentileResponseMetricParser  = &percentileResponseMetricParser{}
	instanceCardinalityResponseMetricParser = &cardinalityResponseMetricParser{}
	instanceMovingAvgResponseMetricParser   = &movingAvgResponseMetricParser{}
	instanceDerivativeResponseMetricParser  = &derivativeResponseMetricParser{}
)

func parseMetricResponse(name string, metric *simplejson.Json, buckets BucketList) tsdb.TimeSeriesSlice {
	id, _ := metric.Get(models.IdKey).String()
	t, _ := metric.Get(models.TypeKey).String()
	parser := GetMetricResponseParser(t)
	if parser != nil {
		return parser.Parse(id, t, name, buckets)
	}
	return tsdb.TimeSeriesSlice{}
}

func GetMetricResponseParser(t string) ResponseMetricParser {
	switch t {
	case models.MetricTypeCount:
		return instanceCountResponseMetricParser
	case models.MetricTypeAvg:
		return instanceAvgResponseMetricParser
	case models.MetricTypeSum:
		return instanceSumResponseMetricParser
	case models.MetricTypeMax:
		return instanceMaxResponseMetricParser
	case models.MetricTypeMin:
		return instanceMinResponseMetricParser
	case models.MetricTypeExtendedStats:
		return instanceStatsResponseMetricParser
	case models.MetricTypePercentiles:
		return instancePercentileResponseMetricParser
	case models.MetricTypeCardinality:
		return instanceCardinalityResponseMetricParser
	case models.MetricTypeMovAvg:
		return instanceMovingAvgResponseMetricParser
	case models.MetricTypeDerivative:
		return instanceDerivativeResponseMetricParser
	default:
		return nil
	}
}

type ResponseMetricParser interface {
	Parse(id, metricType, name string, buckets BucketList) tsdb.TimeSeriesSlice
}

type countResponseMetricParser struct{}
type avgResponseMetricParser struct{}
type sumResponseMetricParser struct{}
type maxResponseMetricParser struct{}
type minResponseMetricParser struct{}
type statsResponseMetricParser struct{}
type percentileResponseMetricParser struct{}
type cardinalityResponseMetricParser struct{}
type movingAvgResponseMetricParser struct{}
type derivativeResponseMetricParser struct{}

func (parser *countResponseMetricParser) Parse(id, metricType, name string, buckets BucketList) tsdb.TimeSeriesSlice {
	points := tsdb.NewTimeSeriesPointsFromArgs()
	for _, b := range buckets {
		timeMillis := b.Key
		value := b.DocCount
		points = append(points, tsdb.NewTimePoint(null.FloatFrom(float64(value)), float64(timeMillis)))
	}
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name), points)}
}

func (parser *avgResponseMetricParser) Parse(id, metricType, name string, buckets BucketList) tsdb.TimeSeriesSlice {
	points := tsdb.NewTimeSeriesPointsFromArgs()
	for _, b := range buckets {
		timeMillis := b.Key
		metric, success := b.Avg(id)
		if !success {
			continue
		}
		val := metric.Value
		points = append(points, tsdb.NewTimePoint(null.FloatFromPtr(val), float64(timeMillis)))
	}
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name), points)}
}

func (parser *sumResponseMetricParser) Parse(id, metricType, name string, buckets BucketList) tsdb.TimeSeriesSlice {

	points := tsdb.NewTimeSeriesPointsFromArgs()
	for _, b := range buckets {
		timeMillis := b.Key
		metric, success := b.Sum(id)
		if !success {
			continue
		}
		val := metric.Value
		points = append(points, tsdb.NewTimePoint(null.FloatFromPtr(val), float64(timeMillis)))
	}
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name), points)}
}

func (parser *maxResponseMetricParser) Parse(id, metricType, name string, buckets BucketList) tsdb.TimeSeriesSlice {
	points := tsdb.NewTimeSeriesPointsFromArgs()
	for _, b := range buckets {
		timeMillis := b.Key
		metric, success := b.Max(id)
		if !success {
			continue
		}
		val := metric.Value
		points = append(points, tsdb.NewTimePoint(null.FloatFromPtr(val), float64(timeMillis)))
	}
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name), points)}
}

func (parser *minResponseMetricParser) Parse(id, metricType, name string, buckets BucketList) tsdb.TimeSeriesSlice {
	points := tsdb.NewTimeSeriesPointsFromArgs()
	for _, b := range buckets {
		timeMillis := b.Key
		metric, success := b.Min(id)
		if !success {
			continue
		}
		val := metric.Value
		points = append(points, tsdb.NewTimePoint(null.FloatFromPtr(val), float64(timeMillis)))
	}
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name), points)}
}

func (parser *statsResponseMetricParser) Parse(id, metricType, name string, buckets BucketList) tsdb.TimeSeriesSlice {
	minPoints := tsdb.NewTimeSeriesPointsFromArgs()
	maxPoints := tsdb.NewTimeSeriesPointsFromArgs()
	sumPoints := tsdb.NewTimeSeriesPointsFromArgs()
	cntPoints := tsdb.NewTimeSeriesPointsFromArgs()
	avgPoints := tsdb.NewTimeSeriesPointsFromArgs()
	stdDevPoints := tsdb.NewTimeSeriesPointsFromArgs()
	// cannot dealy with stdDevUpper and stdDevLower for now
	//stdDevUpperPoints := tsdb.NewTimeSeriesPointsFromArgs()
	//stdDevLowerPoints := tsdb.NewTimeSeriesPointsFromArgs()
	for _, b := range buckets {
		timeMillis := b.Key
		metric, success := b.ExtendedStats(id)
		if !success {
			continue
		}
		minPoints = append(minPoints, tsdb.NewTimePoint(null.FloatFromPtr(metric.Min), float64(timeMillis)))
		maxPoints = append(maxPoints, tsdb.NewTimePoint(null.FloatFromPtr(metric.Max), float64(timeMillis)))
		sumPoints = append(sumPoints, tsdb.NewTimePoint(null.FloatFromPtr(metric.Sum), float64(timeMillis)))
		avgPoints = append(avgPoints, tsdb.NewTimePoint(null.FloatFromPtr(metric.Avg), float64(timeMillis)))
		cntPoints = append(cntPoints, tsdb.NewTimePoint(null.FloatFrom(float64(metric.Count)), float64(timeMillis)))
		stdDevPoints = append(stdDevPoints, tsdb.NewTimePoint(null.FloatFromPtr(metric.StdDeviation), float64(timeMillis)))
	}
	return tsdb.TimeSeriesSlice{
		tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name)+": min", minPoints),
		tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name)+": max", maxPoints),
		tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name)+": sum", sumPoints),
		tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name)+": avg", avgPoints),
		tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name)+": cnt", cntPoints),
		tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name)+": stdDev", stdDevPoints),
	}
}

func (parser *percentileResponseMetricParser) Parse(id, metricType, name string, buckets BucketList) tsdb.TimeSeriesSlice {
	smap := map[string]tsdb.TimeSeriesPoints{}
	for _, b := range buckets {
		timeMillis := b.Key
		metric, success := b.Percentiles(id)
		if !success {
			continue
		}
		for k, v := range metric.Values {
			_, exist := smap[k]
			if !exist {
				smap[k] = tsdb.TimeSeriesPoints{}
			}
			smap[k] = append(smap[k], tsdb.NewTimePoint(null.FloatFrom(v), float64(timeMillis)))
		}
	}
	result := tsdb.TimeSeriesSlice{}
	for k, points := range smap {
		result = append(result, tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name)+":"+k, points))
	}
	return result
}

func (parser *cardinalityResponseMetricParser) Parse(id, metricType, name string, buckets BucketList) tsdb.TimeSeriesSlice {
	points := tsdb.NewTimeSeriesPointsFromArgs()
	for _, b := range buckets {
		timeMillis := b.Key
		metric, success := b.Cardinality(id)
		if !success {
			continue
		}
		val := metric.Value
		points = append(points, tsdb.NewTimePoint(null.FloatFromPtr(val), float64(timeMillis)))
	}
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name), points)}
}

func (parser *derivativeResponseMetricParser) Parse(id, metricType, name string, buckets BucketList) tsdb.TimeSeriesSlice {
	points := tsdb.NewTimeSeriesPointsFromArgs()
	for _, b := range buckets {
		timeMillis := b.Key
		metric, success := b.Derivative(id)
		if !success {
			continue
		}
		val := metric.Value
		points = append(points, tsdb.NewTimePoint(null.FloatFromPtr(val), float64(timeMillis)))
	}
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name), points)}
}

func (parser *movingAvgResponseMetricParser) Parse(id, metricType, name string, buckets BucketList) tsdb.TimeSeriesSlice {
	points := tsdb.NewTimeSeriesPointsFromArgs()
	for _, b := range buckets {
		timeMillis := b.Key
		metric, success := b.MovAvg(id)
		if !success {
			continue
		}
		val := metric.Value
		points = append(points, tsdb.NewTimePoint(null.FloatFromPtr(val), float64(timeMillis)))
	}
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(fmt.Sprintf("%s%s %s", metricType, id, name), points)}
}
