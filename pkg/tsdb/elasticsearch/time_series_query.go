package elasticsearch

import (
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/components/simplejson"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
)

type timeSeriesQuery struct {
	client             es.Client
	dataQueries        []backend.DataQuery
	intervalCalculator intervalv2.Calculator
}

var newTimeSeriesQuery = func(client es.Client, dataQuery []backend.DataQuery,
	intervalCalculator intervalv2.Calculator) *timeSeriesQuery {
	return &timeSeriesQuery{
		client:             client,
		dataQueries:        dataQuery,
		intervalCalculator: intervalCalculator,
	}
}

func (e *timeSeriesQuery) execute() (*backend.QueryDataResponse, error) {
	tsQueryParser := newTimeSeriesQueryParser()
	queries, err := tsQueryParser.parse(e.dataQueries)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	ms := e.client.MultiSearch()

	from := e.dataQueries[0].TimeRange.From.UnixNano() / int64(time.Millisecond)
	to := e.dataQueries[0].TimeRange.To.UnixNano() / int64(time.Millisecond)
	result := backend.QueryDataResponse{
		Responses: backend.Responses{},
	}
	for _, q := range queries {
		if err := e.processQuery(q, ms, from, to, result); err != nil {
			return &backend.QueryDataResponse{}, err
		}
	}

	req, err := ms.Build()
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	res, err := e.client.ExecuteMultisearch(req)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	rp := newResponseParser(res.Responses, queries, res.DebugInfo)
	return rp.getTimeSeries()
}

func (e *timeSeriesQuery) processQuery(q *Query, ms *es.MultiSearchRequestBuilder, from, to int64,
	result backend.QueryDataResponse) error {
	minInterval, err := e.client.GetMinInterval(q.Interval)
	if err != nil {
		return err
	}
	interval := e.intervalCalculator.Calculate(e.dataQueries[0].TimeRange, minInterval, q.MaxDataPoints)

	b := ms.Search(interval)
	b.Size(0)
	filters := b.Query().Bool().Filter()
	filters.AddDateRangeFilter(e.client.GetTimeField(), to, from, es.DateFormatEpochMS)

	if q.RawQuery != "" {
		filters.AddQueryStringFilter(q.RawQuery, true)
	}

	if len(q.BucketAggs) == 0 {
		if len(q.Metrics) == 0 || q.Metrics[0].Type != "raw_document" {
			result.Responses[q.RefID] = backend.DataResponse{
				Error: fmt.Errorf("invalid query, missing metrics and aggregations"),
			}
			return nil
		}
		metric := q.Metrics[0]
		b.Size(metric.Settings.Get("size").MustInt(500))
		b.SortDesc("@timestamp", "boolean")
		b.AddDocValueField("@timestamp")
		return nil
	}

	aggBuilder := b.Agg()

	// iterate backwards to create aggregations bottom-down
	for _, bucketAgg := range q.BucketAggs {
		bucketAgg.Settings = simplejson.NewFromAny(
			bucketAgg.generateSettingsForDSL(),
		)
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
		m := m
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
						a.Settings = m.generateSettingsForDSL()
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
							a.Settings = m.generateSettingsForDSL()
						})
					}
				} else {
					continue
				}
			}
		} else {
			aggBuilder.Metric(m.ID, m.Type, m.Field, func(a *es.MetricAggregation) {
				a.Settings = m.generateSettingsForDSL()
			})
		}
	}

	return nil
}

func setFloatPath(settings *simplejson.Json, path ...string) {
	if stringValue, err := settings.GetPath(path...).String(); err == nil {
		if value, err := strconv.ParseFloat(stringValue, 64); err == nil {
			settings.SetPath(path, value)
		}
	}
}

func setIntPath(settings *simplejson.Json, path ...string) {
	if stringValue, err := settings.GetPath(path...).String(); err == nil {
		if value, err := strconv.ParseInt(stringValue, 10, 64); err == nil {
			settings.SetPath(path, value)
		}
	}
}

// Casts values to float when required by Elastic's query DSL
func (metricAggregation MetricAgg) generateSettingsForDSL() map[string]interface{} {
	switch metricAggregation.Type {
	case "moving_avg":
		setFloatPath(metricAggregation.Settings, "window")
		setFloatPath(metricAggregation.Settings, "predict")
		setFloatPath(metricAggregation.Settings, "settings", "alpha")
		setFloatPath(metricAggregation.Settings, "settings", "beta")
		setFloatPath(metricAggregation.Settings, "settings", "gamma")
		setFloatPath(metricAggregation.Settings, "settings", "period")
	case "serial_diff":
		setFloatPath(metricAggregation.Settings, "lag")
	}

	if isMetricAggregationWithInlineScriptSupport(metricAggregation.Type) {
		scriptValue, err := metricAggregation.Settings.GetPath("script").String()
		if err != nil {
			// the script is stored using the old format : `script:{inline: "value"}` or is not set
			scriptValue, err = metricAggregation.Settings.GetPath("script", "inline").String()
		}

		if err == nil {
			metricAggregation.Settings.SetPath([]string{"script"}, scriptValue)
		}
	}

	return metricAggregation.Settings.MustMap()
}

func (bucketAgg BucketAgg) generateSettingsForDSL() map[string]interface{} {
	// TODO: This might also need to be applied to other bucket aggregations and other fields.
	switch bucketAgg.Type {
	case "date_histogram":
		setIntPath(bucketAgg.Settings, "min_doc_count")
	}

	return bucketAgg.Settings.MustMap()
}

func addDateHistogramAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg, timeFrom, timeTo int64) es.AggBuilder {
	aggBuilder.DateHistogram(bucketAgg.ID, bucketAgg.Field, func(a *es.DateHistogramAgg, b es.AggBuilder) {
		a.FixedInterval = bucketAgg.Settings.Get("interval").MustString("auto")
		a.MinDocCount = bucketAgg.Settings.Get("min_doc_count").MustInt(0)
		a.ExtendedBounds = &es.ExtendedBounds{Min: timeFrom, Max: timeTo}
		a.Format = bucketAgg.Settings.Get("format").MustString(es.DateFormatEpochMS)

		if a.FixedInterval == "auto" {
			// note this is not really a valid grafana-variable-handling,
			// because normally this would not match `$__interval_ms`,
			// but because how we apply these in the go-code, this will work
			// correctly, and becomes something like `500ms`.
			// a nicer way would be to use `${__interval_ms}ms`, but
			// that format is not recognized where we apply these variables
			// in the elasticsearch datasource
			a.FixedInterval = "$__interval_msms"
		}

		if offset, err := bucketAgg.Settings.Get("offset").String(); err == nil {
			a.Offset = offset
		}

		if missing, err := bucketAgg.Settings.Get("missing").String(); err == nil {
			a.Missing = &missing
		}

		if timezone, err := bucketAgg.Settings.Get("timeZone").String(); err == nil {
			if timezone != "utc" {
				a.TimeZone = timezone
			}
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
			/*
			   The format for extended stats and percentiles is {metricId}[bucket_path]
			   for everything else it's just {metricId}, _count, _term, or _key
			*/
			metricIdRegex := regexp.MustCompile(`^(\d+)`)
			metricId := metricIdRegex.FindString(orderBy)

			if len(metricId) > 0 {
				for _, m := range metrics {
					if m.ID == metricId {
						if m.Type == "count" {
							a.Order["_count"] = bucketAgg.Settings.Get("order").MustString("desc")
						} else {
							a.Order[orderBy] = bucketAgg.Settings.Get("order").MustString("desc")
							b.Metric(m.ID, m.Type, m.Field, nil)
						}
						break
					}
				}
			} else {
				a.Order[orderBy] = bucketAgg.Settings.Get("order").MustString("desc")
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

func (p *timeSeriesQueryParser) parse(tsdbQuery []backend.DataQuery) ([]*Query, error) {
	queries := make([]*Query, 0)
	for _, q := range tsdbQuery {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			return nil, err
		}
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

		queries = append(queries, &Query{
			TimeField:     timeField,
			RawQuery:      rawQuery,
			BucketAggs:    bucketAggs,
			Metrics:       metrics,
			Alias:         alias,
			Interval:      interval,
			RefID:         q.RefID,
			MaxDataPoints: q.MaxDataPoints,
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
