package es2

import (
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/models"
	"github.com/pkg/errors"
	"gopkg.in/olivere/elastic.v3"
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
	dh, success := r.Aggregations.DateHistogram(query.RefId)
	if !success {
		return nil, errors.New("not DateHistogram")
	}

	metrics, err := query.Model.Get(metricKey).Array()
	if err != nil {
		return nil, err
	}

	for _, m := range metrics {
		metric := simplejson.NewFromAny(m)
		result.Series = append(result.Series, parseMetricResponse(metric, dh.Buckets)...)
	}

	return result, nil
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

func parseMetricResponse(metric *simplejson.Json, buckets []*elastic.AggregationBucketHistogramItem) tsdb.TimeSeriesSlice {
	id, _ := metric.Get("id").String()
	t, _ := metric.Get("type").String()
	parser := GetMetricResponseParser(t)
	if parser != nil {
		return parser.Parse(id, t, buckets)
	}
	return tsdb.TimeSeriesSlice{}
}

func GetMetricResponseParser(t string) ResponseMetricParser {
	switch t {
	case models.AggTypeCount:
		return instanceCountResponseMetricParser
	case models.AggTypeAvg:
		return instanceAvgResponseMetricParser
	case models.AggTypeSum:
		return instanceSumResponseMetricParser
	case models.AggTypeMax:
		return instanceMaxResponseMetricParser
	case models.AggTypeMin:
		return instanceMinResponseMetricParser
	case models.AggTypeExtendedStats:
		return instanceStatsResponseMetricParser
	case models.AggTypePercentiles:
		return instancePercentileResponseMetricParser
	case models.AggTypeCardinality:
		return instanceCardinalityResponseMetricParser
	case models.AggTypeMovAvg:
		return instanceMovingAvgResponseMetricParser
	case models.AggTypeDerivative:
		return instanceDerivativeResponseMetricParser
	default:
		return nil
	}
}

type ResponseMetricParser interface {
	Parse(id, metricType string, buckets []*elastic.AggregationBucketHistogramItem) tsdb.TimeSeriesSlice
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

func (parser *countResponseMetricParser) Parse(id, metricType string, buckets []*elastic.AggregationBucketHistogramItem) tsdb.TimeSeriesSlice {
	points := tsdb.NewTimeSeriesPointsFromArgs()
	for _, b := range buckets {
		timeMillis := b.Key
		value := b.DocCount
		points = append(points, tsdb.NewTimePoint(null.FloatFrom(float64(value)), float64(timeMillis)))
	}
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(metricType+id, points)}
}

func (parser *avgResponseMetricParser) Parse(id, metricType string, buckets []*elastic.AggregationBucketHistogramItem) tsdb.TimeSeriesSlice {
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
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(metricType+id, points)}
}

func (parser *sumResponseMetricParser) Parse(id, metricType string, buckets []*elastic.AggregationBucketHistogramItem) tsdb.TimeSeriesSlice {
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
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(metricType+id, points)}
}

func (parser *maxResponseMetricParser) Parse(id, metricType string, buckets []*elastic.AggregationBucketHistogramItem) tsdb.TimeSeriesSlice {
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
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(metricType+id, points)}
}

func (parser *minResponseMetricParser) Parse(id, metricType string, buckets []*elastic.AggregationBucketHistogramItem) tsdb.TimeSeriesSlice {
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
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(metricType+id, points)}
}

func (parser *statsResponseMetricParser) Parse(id, metricType string, buckets []*elastic.AggregationBucketHistogramItem) tsdb.TimeSeriesSlice {
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
		tsdb.NewTimeSeries(metricType+id+": min", minPoints),
		tsdb.NewTimeSeries(metricType+id+": max", maxPoints),
		tsdb.NewTimeSeries(metricType+id+": sum", sumPoints),
		tsdb.NewTimeSeries(metricType+id+": avg", avgPoints),
		tsdb.NewTimeSeries(metricType+id+": cnt", cntPoints),
		tsdb.NewTimeSeries(metricType+id+": stdDev", stdDevPoints),
	}
}

func (parser *percentileResponseMetricParser) Parse(id, metricType string, buckets []*elastic.AggregationBucketHistogramItem) tsdb.TimeSeriesSlice {
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
		result = append(result, tsdb.NewTimeSeries(metricType+id+":"+k, points))
	}
	return result
}

func (parser *cardinalityResponseMetricParser) Parse(id, metricType string, buckets []*elastic.AggregationBucketHistogramItem) tsdb.TimeSeriesSlice {
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
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(metricType+id, points)}
}

func (parser *derivativeResponseMetricParser) Parse(id, metricType string, buckets []*elastic.AggregationBucketHistogramItem) tsdb.TimeSeriesSlice {
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
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(metricType+id, points)}
}

func (parser *movingAvgResponseMetricParser) Parse(id, metricType string, buckets []*elastic.AggregationBucketHistogramItem) tsdb.TimeSeriesSlice {
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
	return tsdb.TimeSeriesSlice{tsdb.NewTimeSeries(metricType+id, points)}
}
