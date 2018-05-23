package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"golang.org/x/net/context/ctxhttp"
)

type timeSeriesQuery struct {
	queries []*Query
}

func (e *ElasticsearchExecutor) executeTimeSeriesQuery(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{}
	result.Results = make(map[string]*tsdb.QueryResult)

	tsQueryParser := newTimeSeriesQueryParser(dsInfo)
	query, err := tsQueryParser.parse(tsdbQuery)
	if err != nil {
		return nil, err
	}

	buff := bytes.Buffer{}
	for _, q := range query.queries {
		s, err := q.Build(tsdbQuery, dsInfo)
		if err != nil {
			return nil, err
		}
		buff.WriteString(s)
	}
	payload := buff.String()

	if setting.Env == setting.DEV {
		glog.Debug("Elasticsearch playload", "raw playload", payload)
	}
	glog.Info("Elasticsearch playload", "raw playload", payload)

	req, err := e.createRequest(dsInfo, payload)
	if err != nil {
		return nil, err
	}

	httpClient, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	resp, err := ctxhttp.Do(ctx, httpClient, req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("elasticsearch returned statuscode invalid status code: %v", resp.Status)
	}

	var responses Responses
	defer resp.Body.Close()
	dec := json.NewDecoder(resp.Body)
	dec.UseNumber()
	err = dec.Decode(&responses)
	if err != nil {
		return nil, err
	}

	for _, res := range responses.Responses {
		if res.Err != nil {
			return nil, errors.New(res.getErrMsg())
		}
	}
	responseParser := ElasticsearchResponseParser{responses.Responses, query.queries}
	queryRes := responseParser.getTimeSeries()
	result.Results["A"] = queryRes
	return result, nil
}

type timeSeriesQueryParser struct {
	ds *models.DataSource
}

func newTimeSeriesQueryParser(ds *models.DataSource) *timeSeriesQueryParser {
	return &timeSeriesQueryParser{
		ds: ds,
	}
}

func (p *timeSeriesQueryParser) parse(tsdbQuery *tsdb.TsdbQuery) (*timeSeriesQuery, error) {
	queries := make([]*Query, 0)
	for _, q := range tsdbQuery.Queries {
		model := q.Model
		timeField, err := model.Get("timeField").String()
		if err != nil {
			return nil, err
		}
		rawQuery := model.Get("query").MustString()
		bucketAggs, err := p.parseBucketAggs(model)
		if err != nil {
			return nil, err
		}
		metrics, err := p.parseMetrics(model)
		if err != nil {
			return nil, err
		}
		alias := model.Get("alias").MustString("")
		parsedInterval, err := tsdb.GetIntervalFrom(p.ds, model, time.Millisecond)
		if err != nil {
			return nil, err
		}

		queries = append(queries, &Query{
			TimeField:  timeField,
			RawQuery:   rawQuery,
			BucketAggs: bucketAggs,
			Metrics:    metrics,
			Alias:      alias,
			Interval:   parsedInterval,
		})
	}

	return &timeSeriesQuery{queries: queries}, nil
}

func (p *timeSeriesQueryParser) parseBucketAggs(model *simplejson.Json) ([]*BucketAgg, error) {
	var err error
	var result []*BucketAgg
	for _, t := range model.Get("bucketAggs").MustArray() {
		aggJson := simplejson.NewFromAny(t)
		agg := &BucketAgg{}

		agg.Type, err = aggJson.Get("type").String()
		if err != nil {
			return nil, err
		}

		agg.ID, err = aggJson.Get("id").String()
		if err != nil {
			return nil, err
		}

		agg.Field = aggJson.Get("field").MustString()
		agg.Settings = simplejson.NewFromAny(aggJson.Get("settings").MustMap())

		result = append(result, agg)
	}
	return result, nil
}

func (p *timeSeriesQueryParser) parseMetrics(model *simplejson.Json) ([]*Metric, error) {
	var err error
	var result []*Metric
	for _, t := range model.Get("metrics").MustArray() {
		metricJSON := simplejson.NewFromAny(t)
		metric := &Metric{}

		metric.Field = metricJSON.Get("field").MustString()
		metric.Hide = metricJSON.Get("hide").MustBool(false)
		metric.ID, err = metricJSON.Get("id").String()
		if err != nil {
			return nil, err
		}

		metric.PipelineAggregate = metricJSON.Get("pipelineAgg").MustString()
		metric.Settings = simplejson.NewFromAny(metricJSON.Get("settings").MustMap())

		metric.Type, err = metricJSON.Get("type").String()
		if err != nil {
			return nil, err
		}

		result = append(result, metric)
	}
	return result, nil
}
