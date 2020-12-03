package elasticsearch

import (
	"strconv"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

type timeSeriesQuery struct {
	client             es.Client
	tsdbQuery          *tsdb.TsdbQuery
	intervalCalculator tsdb.IntervalCalculator
}

var newTimeSeriesQuery = func(client es.Client, tsdbQuery *tsdb.TsdbQuery, intervalCalculator tsdb.IntervalCalculator) *timeSeriesQuery {
	return &timeSeriesQuery{
		client:             client,
		tsdbQuery:          tsdbQuery,
		intervalCalculator: intervalCalculator,
	}
}

func (e *timeSeriesQuery) execute() (*tsdb.Response, error) {
	handlers := make(map[string]queryHandler)

	handlers["lucene"] = newLuceneHandler(e.client, e.tsdbQuery, e.intervalCalculator)
	handlers["PPL"] = newPPLHandler(e.client, e.tsdbQuery)

	tsQueryParser := newTimeSeriesQueryParser()
	queries, err := tsQueryParser.parse(e.tsdbQuery)
	if err != nil {
		return nil, err
	}

	for _, q := range queries {
		if err := handlers[q.QueryType].processQuery(q); err != nil {
			return nil, err
		}
	}

	responses := make([]*tsdb.Response, 0)

	for _, handler := range handlers {
		response, err := handler.executeQueries()
		if err != nil {
			return nil, err
		}
		responses = append(responses, response)
	}

	return mergeResponses(responses...), nil
}

type timeSeriesQueryParser struct{}

func newTimeSeriesQueryParser() *timeSeriesQueryParser {
	return &timeSeriesQueryParser{}
}

func (p *timeSeriesQueryParser) parse(tsdbQuery *tsdb.TsdbQuery) ([]*Query, error) {
	queries := make([]*Query, 0)
	for _, q := range tsdbQuery.Queries {
		model := q.Model
		timeField, err := model.Get("timeField").String()
		if err != nil {
			return nil, err
		}
		rawQuery := model.Get("query").MustString()
		queryType := model.Get("queryType").MustString("lucene")
		bucketAggs, err := p.parseBucketAggs(model)
		if err != nil {
			return nil, err
		}
		metrics, err := p.parseMetrics(model)
		if err != nil {
			return nil, err
		}
		alias := model.Get("alias").MustString("")
		interval := strconv.FormatInt(q.IntervalMs, 10) + "ms"

		queries = append(queries, &Query{
			TimeField:  timeField,
			RawQuery:   rawQuery,
			QueryType:  queryType,
			BucketAggs: bucketAggs,
			Metrics:    metrics,
			Alias:      alias,
			Interval:   interval,
			RefID:      q.RefId,
		})
	}

	return queries, nil
}

func (p *timeSeriesQueryParser) parseBucketAggs(model *simplejson.Json) ([]*BucketAgg, error) {
	var err error
	var result []*BucketAgg
	for _, t := range model.Get("bucketAggs").MustArray() {
		aggJSON := simplejson.NewFromAny(t)
		agg := &BucketAgg{}

		agg.Type, err = aggJSON.Get("type").String()
		if err != nil {
			return nil, err
		}

		agg.ID, err = aggJSON.Get("id").String()
		if err != nil {
			return nil, err
		}

		agg.Field = aggJSON.Get("field").MustString()
		agg.Settings = simplejson.NewFromAny(aggJSON.Get("settings").MustMap())

		result = append(result, agg)
	}
	return result, nil
}

func (p *timeSeriesQueryParser) parseMetrics(model *simplejson.Json) ([]*MetricAgg, error) {
	var err error
	var result []*MetricAgg
	for _, t := range model.Get("metrics").MustArray() {
		metricJSON := simplejson.NewFromAny(t)
		metric := &MetricAgg{}

		metric.Field = metricJSON.Get("field").MustString()
		metric.Hide = metricJSON.Get("hide").MustBool(false)
		metric.ID = metricJSON.Get("id").MustString()
		metric.PipelineAggregate = metricJSON.Get("pipelineAgg").MustString()
		metric.Settings = simplejson.NewFromAny(metricJSON.Get("settings").MustMap())
		metric.Meta = simplejson.NewFromAny(metricJSON.Get("meta").MustMap())
		metric.Type, err = metricJSON.Get("type").String()
		if err != nil {
			return nil, err
		}

		if isPipelineAggWithMultipleBucketPaths(metric.Type) {
			metric.PipelineVariables = map[string]string{}
			pvArr := metricJSON.Get("pipelineVariables").MustArray()
			for _, v := range pvArr {
				kv := v.(map[string]interface{})
				metric.PipelineVariables[kv["name"].(string)] = kv["pipelineAgg"].(string)
			}
		}

		result = append(result, metric)
	}
	return result, nil
}

func mergeResponses(responses ...*tsdb.Response) *tsdb.Response {
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}
	for _, response := range responses {
		for k, v := range response.Results {
			result.Results[k] = v
		}
	}
	return result
}
