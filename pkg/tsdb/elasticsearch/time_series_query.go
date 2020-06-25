package elasticsearch

import (
	"fmt"
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
	result := &tsdb.Response{}
	result.Results = make(map[string]*tsdb.QueryResult)

	tsQueryParser := newTimeSeriesQueryParser()
	queries, err := tsQueryParser.parse(e.tsdbQuery)
	if err != nil {
		return nil, err
	}

	ms := e.client.MultiSearch()

	from := fmt.Sprintf("%d", e.tsdbQuery.TimeRange.GetFromAsMsEpoch())
	to := fmt.Sprintf("%d", e.tsdbQuery.TimeRange.GetToAsMsEpoch())

	for _, q := range queries {
		minInterval, err := e.client.GetMinInterval(q.Interval)
		if err != nil {
			return nil, err
		}
		interval := e.intervalCalculator.Calculate(e.tsdbQuery.TimeRange, minInterval)

		b := ms.Search(interval)
		b.Size(0)
		filters := b.Query().Bool().Filter()
		filters.AddDateRangeFilter(e.client.GetTimeField(), to, from, es.DateFormatEpochMS)

		if q.RawQuery != "" {
			filters.AddQueryStringFilter(q.RawQuery, true)
		}

		if len(q.BucketAggs) == 0 {
			if len(q.Metrics) == 0 || q.Metrics[0].Type != "raw_document" {
				result.Results[q.RefID] = &tsdb.QueryResult{
					RefId:       q.RefID,
					Error:       fmt.Errorf("invalid query, missing metrics and aggregations"),
					ErrorString: "invalid query, missing metrics and aggregations",
				}
				continue
			}
			metric := q.Metrics[0]
			b.Size(metric.Settings.Get("size").MustInt(500))
			b.SortDesc("@timestamp", "boolean")
			b.AddDocValueField("@timestamp")
			continue
		}

		aggBuilder := b.Agg()

		// iterate backwards to create aggregations bottom-down
		for _, bucketAgg := range q.BucketAggs {
			switch bucketAgg.Type {
			case dateHistType:
				aggBuilder = addDateHistogramAgg(aggBuilder, bucketAgg, from, to)
			case histogramType:
				aggBuilder = addHistogramAgg(aggBuilder, bucketAgg)
			case filtersType:
				aggBuilder = addFiltersAgg(aggBuilder, bucketAgg)
			case termsType:
				aggBuilder = addTermsAgg(aggBuilder, bucketAgg, q.Metrics)
			case geohashGridType:
				aggBuilder = addGeoHashGridAgg(aggBuilder, bucketAgg)
			}
		}

		for _, m := range q.Metrics {
			if m.Type == countType {
				continue
			}

			if isPipelineAgg(m.Type) {
				if isPipelineAggWithMultipleBucketPaths(m.Type) {
					if len(m.PipelineVariables) > 0 {
						bucketPaths := map[string]interface{}{}
						for name, pipelineAgg := range m.PipelineVariables {
							if _, err := strconv.Atoi(pipelineAgg); err == nil {
								var appliedAgg *MetricAgg
								for _, pipelineMetric := range q.Metrics {
									if pipelineMetric.ID == pipelineAgg {
										appliedAgg = pipelineMetric
										break
									}
								}
								if appliedAgg != nil {
									if appliedAgg.Type == countType {
										bucketPaths[name] = "_count"
									} else {
										bucketPaths[name] = pipelineAgg
									}
								}
							}
						}

						aggBuilder.Pipeline(m.ID, m.Type, bucketPaths, func(a *es.PipelineAggregation) {
							a.Settings = m.Settings.MustMap()
						})
					} else {
						continue
					}
				} else {
					if _, err := strconv.Atoi(m.PipelineAggregate); err == nil {
						var appliedAgg *MetricAgg
						for _, pipelineMetric := range q.Metrics {
							if pipelineMetric.ID == m.PipelineAggregate {
								appliedAgg = pipelineMetric
								break
							}
						}
						if appliedAgg != nil {
							bucketPath := m.PipelineAggregate
							if appliedAgg.Type == countType {
								bucketPath = "_count"
							}

							aggBuilder.Pipeline(m.ID, m.Type, bucketPath, func(a *es.PipelineAggregation) {
								a.Settings = m.Settings.MustMap()
							})
						}
					} else {
						continue
					}
				}
			} else {
				aggBuilder.Metric(m.ID, m.Type, m.Field, func(a *es.MetricAggregation) {
					a.Settings = m.Settings.MustMap()
				})
			}
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

	rp := newResponseParser(res.Responses, queries, res.DebugInfo)
	return rp.getTimeSeries()
}

func addDateHistogramAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg, timeFrom, timeTo string) es.AggBuilder {
	aggBuilder.DateHistogram(bucketAgg.ID, bucketAgg.Field, func(a *es.DateHistogramAgg, b es.AggBuilder) {
		a.Interval = bucketAgg.Settings.Get("interval").MustString("auto")
		a.MinDocCount = bucketAgg.Settings.Get("min_doc_count").MustInt(0)
		a.ExtendedBounds = &es.ExtendedBounds{Min: timeFrom, Max: timeTo}
		a.Format = bucketAgg.Settings.Get("format").MustString(es.DateFormatEpochMS)

		if a.Interval == "auto" {
			a.Interval = "$__interval"
		}

		if offset, err := bucketAgg.Settings.Get("offset").String(); err == nil {
			a.Offset = offset
		}

		if missing, err := bucketAgg.Settings.Get("missing").String(); err == nil {
			a.Missing = &missing
		}

		aggBuilder = b
	})

	return aggBuilder
}

func addHistogramAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	aggBuilder.Histogram(bucketAgg.ID, bucketAgg.Field, func(a *es.HistogramAgg, b es.AggBuilder) {
		a.Interval = bucketAgg.Settings.Get("interval").MustInt(1000)
		a.MinDocCount = bucketAgg.Settings.Get("min_doc_count").MustInt(0)

		if missing, err := bucketAgg.Settings.Get("missing").Int(); err == nil {
			a.Missing = &missing
		}

		aggBuilder = b
	})

	return aggBuilder
}

func addTermsAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg, metrics []*MetricAgg) es.AggBuilder {
	aggBuilder.Terms(bucketAgg.ID, bucketAgg.Field, func(a *es.TermsAggregation, b es.AggBuilder) {
		if size, err := bucketAgg.Settings.Get("size").Int(); err == nil {
			a.Size = size
		} else if size, err := bucketAgg.Settings.Get("size").String(); err == nil {
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

		if minDocCount, err := bucketAgg.Settings.Get("min_doc_count").Int(); err == nil {
			a.MinDocCount = &minDocCount
		}
		if missing, err := bucketAgg.Settings.Get("missing").String(); err == nil {
			a.Missing = &missing
		}

		if orderBy, err := bucketAgg.Settings.Get("orderBy").String(); err == nil {
			a.Order[orderBy] = bucketAgg.Settings.Get("order").MustString("desc")

			if _, err := strconv.Atoi(orderBy); err == nil {
				for _, m := range metrics {
					if m.ID == orderBy {
						b.Metric(m.ID, m.Type, m.Field, nil)
						break
					}
				}
			}
		}

		aggBuilder = b
	})

	return aggBuilder
}

func addFiltersAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	filters := make(map[string]interface{})
	for _, filter := range bucketAgg.Settings.Get("filters").MustArray() {
		json := simplejson.NewFromAny(filter)
		query := json.Get("query").MustString()
		label := json.Get("label").MustString()
		if label == "" {
			label = query
		}
		filters[label] = &es.QueryStringFilter{Query: query, AnalyzeWildcard: true}
	}

	if len(filters) > 0 {
		aggBuilder.Filters(bucketAgg.ID, func(a *es.FiltersAggregation, b es.AggBuilder) {
			a.Filters = filters
			aggBuilder = b
		})
	}

	return aggBuilder
}

func addGeoHashGridAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	aggBuilder.GeoHashGrid(bucketAgg.ID, bucketAgg.Field, func(a *es.GeoHashGridAggregation, b es.AggBuilder) {
		a.Precision = bucketAgg.Settings.Get("precision").MustInt(3)
		aggBuilder = b
	})

	return aggBuilder
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
