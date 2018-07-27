package elasticsearch

import (
	"fmt"
	"regexp"
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
	tsQueryParser := newTimeSeriesQueryParser()
	queries, err := tsQueryParser.parse(e.tsdbQuery)
	if err != nil {
		return nil, err
	}

	ms := e.client.MultiSearch()

	from := fmt.Sprintf("%d", e.tsdbQuery.TimeRange.GetFromAsMsEpoch())
	to := fmt.Sprintf("%d", e.tsdbQuery.TimeRange.GetToAsMsEpoch())
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}
	for _, q := range queries {
		if err := e.processQuery(q, ms, from, to, result); err != nil {
			return nil, err
		}
	}

	req, err := ms.Build()
	if err != nil {
		return nil, err
	}

	res, err := e.client.ExecuteMultisearch(req)
	if err != nil {
		return nil, err
	}

	rt := newTimeSeriesQueryResponseTransformer(res.Responses, queries, res.DebugInfo)
	return rt.transform()
}

func (e *timeSeriesQuery) processQuery(q *timeSeriesQueryModel, ms *es.MultiSearchRequestBuilder, from, to string,
	result *tsdb.Response) error {
	minInterval, err := e.client.GetMinInterval(q.interval)
	if err != nil {
		return err
	}
	interval := e.intervalCalculator.Calculate(e.tsdbQuery.TimeRange, minInterval)

	b := ms.Search(interval)
	b.Size(0)
	filters := b.Query().Bool().Filter()
	filters.AddDateRangeFilter(e.client.GetTimeField(), to, from, es.DateFormatEpochMS)

	if q.queryString != "" {
		filters.AddQueryStringFilter(q.queryString, true)
	}

	if len(q.bucketAggs) == 0 {
		if len(q.metrics) == 0 || q.metrics[0].aggType != "raw_document" {
			result.Results[q.refID] = &tsdb.QueryResult{
				RefId:       q.refID,
				Error:       fmt.Errorf("invalid query, missing metrics and aggregations"),
				ErrorString: "invalid query, missing metrics and aggregations",
			}
		}

		metric := q.metrics[0]
		b.Size(metric.settings.Get("size").MustInt(500))
		b.SortDesc("@timestamp", "boolean")
		b.AddDocValueField("@timestamp")
		return nil
	}

	aggBuilder := b.Agg()

	// iterate backwards to create aggregations bottom-down
	for _, bucketAgg := range q.bucketAggs {
		switch bucketAgg.aggType {
		case dateHistType:
			aggBuilder = addDateHistogramAgg(aggBuilder, bucketAgg, from, to)
		case histogramType:
			aggBuilder = addHistogramAgg(aggBuilder, bucketAgg)
		case filtersType:
			aggBuilder = addFiltersAgg(aggBuilder, bucketAgg)
		case termsType:
			aggBuilder = addTermsAgg(aggBuilder, bucketAgg, q.metrics)
		case geohashGridType:
			aggBuilder = addGeoHashGridAgg(aggBuilder, bucketAgg)
		}
	}

	for _, m := range q.metrics {
		m := m
		if m.aggType == countType {
			continue
		}

		if isPipelineAgg(m.aggType) {
			if isPipelineAggWithMultipleBucketPaths(m.aggType) {
				if len(m.pipelineVariables) > 0 {
					bucketPaths := map[string]interface{}{}
					for name, pipelineAgg := range m.pipelineVariables {
						if _, err := strconv.Atoi(pipelineAgg); err == nil {
							var appliedAgg *metricAggregation
							for _, pipelineMetric := range q.metrics {
								if pipelineMetric.id == pipelineAgg {
									appliedAgg = pipelineMetric
									break
								}
							}
							if appliedAgg != nil {
								if appliedAgg.aggType == countType {
									bucketPaths[name] = "_count"
								} else {
									bucketPaths[name] = pipelineAgg
								}
							}
						}
					}

					aggBuilder.Pipeline(m.id, m.aggType, bucketPaths, func(a *es.PipelineAggregation) {
						a.Settings = m.settings.MustMap()
					})
				} else {
					continue
				}
			} else {
				if _, err := strconv.Atoi(m.pipelineAggregate); err == nil {
					var appliedAgg *metricAggregation
					for _, pipelineMetric := range q.metrics {
						if pipelineMetric.id == m.pipelineAggregate {
							appliedAgg = pipelineMetric
							break
						}
					}
					if appliedAgg != nil {
						bucketPath := m.pipelineAggregate
						if appliedAgg.aggType == countType {
							bucketPath = "_count"
						}

						aggBuilder.Pipeline(m.id, m.aggType, bucketPath, func(a *es.PipelineAggregation) {
							a.Settings = m.settings.MustMap()
						})
					}
				} else {
					continue
				}
			}
		} else {
			aggBuilder.Metric(m.id, m.aggType, m.field, func(a *es.MetricAggregation) {
				a.Settings = m.settings.MustMap()
			})
		}
	}

	return nil
}

func addDateHistogramAgg(aggBuilder es.AggBuilder, bucketAgg *bucketAggregation, timeFrom, timeTo string) es.AggBuilder {
	aggBuilder.DateHistogram(bucketAgg.id, bucketAgg.field, func(a *es.DateHistogramAgg, b es.AggBuilder) {
		a.Interval = bucketAgg.settings.Get("interval").MustString("auto")
		a.MinDocCount = bucketAgg.settings.Get("min_doc_count").MustInt(0)
		a.ExtendedBounds = &es.ExtendedBounds{Min: timeFrom, Max: timeTo}
		a.Format = bucketAgg.settings.Get("format").MustString(es.DateFormatEpochMS)

		if a.Interval == "auto" {
			a.Interval = "$__interval"
		}

		if offset, err := bucketAgg.settings.Get("offset").String(); err == nil {
			a.Offset = offset
		}

		if missing, err := bucketAgg.settings.Get("missing").String(); err == nil {
			a.Missing = &missing
		}

		aggBuilder = b
	})

	return aggBuilder
}

func addHistogramAgg(aggBuilder es.AggBuilder, bucketAgg *bucketAggregation) es.AggBuilder {
	aggBuilder.Histogram(bucketAgg.id, bucketAgg.field, func(a *es.HistogramAgg, b es.AggBuilder) {
		a.Interval = bucketAgg.settings.Get("interval").MustInt(1000)
		a.MinDocCount = bucketAgg.settings.Get("min_doc_count").MustInt(0)

		if missing, err := bucketAgg.settings.Get("missing").Int(); err == nil {
			a.Missing = &missing
		}

		aggBuilder = b
	})

	return aggBuilder
}

func addTermsAgg(aggBuilder es.AggBuilder, bucketAgg *bucketAggregation, metrics []*metricAggregation) es.AggBuilder {
	aggBuilder.Terms(bucketAgg.id, bucketAgg.field, func(a *es.TermsAggregation, b es.AggBuilder) {
		if size, err := bucketAgg.settings.Get("size").Int(); err == nil {
			a.Size = size
		} else if size, err := bucketAgg.settings.Get("size").String(); err == nil {
			a.Size, err = strconv.Atoi(size)
			if err != nil {
				a.Size = 500
			}
		} else {
			a.Size = 500
		}
		if a.Size == 0 {
			a.Size = 500
		}

		if minDocCount, err := bucketAgg.settings.Get("min_doc_count").Int(); err == nil {
			a.MinDocCount = &minDocCount
		}
		if missing, err := bucketAgg.settings.Get("missing").String(); err == nil {
			a.Missing = &missing
		}

		if orderBy, err := bucketAgg.settings.Get("orderBy").String(); err == nil {
			/*
			   The format for extended stats and percentiles is {metricId}[bucket_path]
			   for everything else it's just {metricId}, _count, _term, or _key
			*/
			metricIdRegex := regexp.MustCompile(`^(\d+)`)
			metricId := metricIdRegex.FindString(orderBy)

			if len(metricId) > 0 {
				for _, m := range metrics {
					if m.id == metricId {
						if m.aggType == "count" {
							a.Order["_count"] = bucketAgg.settings.Get("order").MustString("desc")
						} else {
							a.Order[orderBy] = bucketAgg.settings.Get("order").MustString("desc")
							b.Metric(m.id, m.aggType, m.field, nil)
						}
						break
					}
				}
			} else {
				a.Order[orderBy] = bucketAgg.settings.Get("order").MustString("desc")
			}
		}

		aggBuilder = b
	})

	return aggBuilder
}

func addFiltersAgg(aggBuilder es.AggBuilder, bucketAgg *bucketAggregation) es.AggBuilder {
	filters := make(map[string]interface{})
	for _, filter := range bucketAgg.settings.Get("filters").MustArray() {
		json := simplejson.NewFromAny(filter)
		query := json.Get("query").MustString()
		label := json.Get("label").MustString()
		if label == "" {
			label = query
		}
		filters[label] = &es.QueryStringFilter{Query: query, AnalyzeWildcard: true}
	}

	if len(filters) > 0 {
		aggBuilder.Filters(bucketAgg.id, func(a *es.FiltersAggregation, b es.AggBuilder) {
			a.Filters = filters
			aggBuilder = b
		})
	}

	return aggBuilder
}

func addGeoHashGridAgg(aggBuilder es.AggBuilder, bucketAgg *bucketAggregation) es.AggBuilder {
	aggBuilder.GeoHashGrid(bucketAgg.id, bucketAgg.field, func(a *es.GeoHashGridAggregation, b es.AggBuilder) {
		a.Precision = bucketAgg.settings.Get("precision").MustInt(3)
		aggBuilder = b
	})

	return aggBuilder
}

type timeSeriesQueryParser struct{}

func newTimeSeriesQueryParser() *timeSeriesQueryParser {
	return &timeSeriesQueryParser{}
}

func (p *timeSeriesQueryParser) parse(tsdbQuery *tsdb.TsdbQuery) ([]*timeSeriesQueryModel, error) {
	queries := make([]*timeSeriesQueryModel, 0)
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
		interval := model.Get("interval").MustString("")

		queries = append(queries, &timeSeriesQueryModel{
			timeField:   timeField,
			queryString: rawQuery,
			bucketAggs:  bucketAggs,
			metrics:     metrics,
			alias:       alias,
			interval:    interval,
			refID:       q.RefId,
		})
	}

	return queries, nil
}

func (p *timeSeriesQueryParser) parseBucketAggs(model *simplejson.Json) ([]*bucketAggregation, error) {
	var err error
	var result []*bucketAggregation
	for _, t := range model.Get("bucketAggs").MustArray() {
		aggJSON := simplejson.NewFromAny(t)
		agg := &bucketAggregation{}

		agg.aggType, err = aggJSON.Get("type").String()
		if err != nil {
			return nil, err
		}

		agg.id, err = aggJSON.Get("id").String()
		if err != nil {
			return nil, err
		}

		agg.field = aggJSON.Get("field").MustString()
		agg.settings = simplejson.NewFromAny(aggJSON.Get("settings").MustMap())

		result = append(result, agg)
	}
	return result, nil
}

func (p *timeSeriesQueryParser) parseMetrics(model *simplejson.Json) ([]*metricAggregation, error) {
	var err error
	var result []*metricAggregation
	for _, t := range model.Get("metrics").MustArray() {
		metricJSON := simplejson.NewFromAny(t)
		metric := &metricAggregation{}

		metric.field = metricJSON.Get("field").MustString()
		metric.hide = metricJSON.Get("hide").MustBool(false)
		metric.id = metricJSON.Get("id").MustString()
		metric.pipelineAggregate = metricJSON.Get("pipelineAgg").MustString()
		metric.settings = simplejson.NewFromAny(metricJSON.Get("settings").MustMap())
		metric.meta = simplejson.NewFromAny(metricJSON.Get("meta").MustMap())

		metric.aggType, err = metricJSON.Get("type").String()
		if err != nil {
			return nil, err
		}

		if isPipelineAggWithMultipleBucketPaths(metric.aggType) {
			metric.pipelineVariables = map[string]string{}
			pvArr := metricJSON.Get("pipelineVariables").MustArray()
			for _, v := range pvArr {
				kv := v.(map[string]interface{})
				metric.pipelineVariables[kv["name"].(string)] = kv["pipelineAgg"].(string)
			}
		}

		result = append(result, metric)
	}
	return result, nil
}
