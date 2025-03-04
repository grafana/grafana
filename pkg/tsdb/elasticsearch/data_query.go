package elasticsearch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/grafana/grafana/pkg/components/simplejson"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

const (
	defaultSize = 500
)

type elasticsearchDataQuery struct {
	client               es.Client
	dataQueries          []backend.DataQuery
	logger               log.Logger
	ctx                  context.Context
	keepLabelsInResponse bool
}

var newElasticsearchDataQuery = func(ctx context.Context, client es.Client, req *backend.QueryDataRequest, logger log.Logger) *elasticsearchDataQuery {
	_, fromAlert := req.Headers[headerFromAlert]
	fromExpression := req.GetHTTPHeader(headerFromExpression) != ""

	return &elasticsearchDataQuery{
		client:      client,
		dataQueries: req.Queries,
		logger:      logger,
		ctx:         ctx,
		// To maintain backward compatibility, it is necessary to keep labels in responses for alerting and expressions queries.
		// Historically, these labels have been used in alerting rules and transformations.
		keepLabelsInResponse: fromAlert || fromExpression,
	}
}

func (e *elasticsearchDataQuery) execute() (*backend.QueryDataResponse, error) {
	start := time.Now()
	response := backend.NewQueryDataResponse()
	e.logger.Debug("Parsing queries", "queriesLength", len(e.dataQueries))
	queries, err := parseQuery(e.dataQueries, e.logger)
	if err != nil {
		mq, _ := json.Marshal(e.dataQueries)
		e.logger.Error("Failed to parse queries", "error", err, "queries", string(mq), "queriesLength", len(queries), "duration", time.Since(start), "stage", es.StagePrepareRequest)
		response.Responses[e.dataQueries[0].RefID] = backend.ErrorResponseWithErrorSource(err)
		return response, nil
	}

	ms := e.client.MultiSearch()

	for _, q := range queries {
		from := q.TimeRange.From.UnixNano() / int64(time.Millisecond)
		to := q.TimeRange.To.UnixNano() / int64(time.Millisecond)
		if err := e.processQuery(q, ms, from, to); err != nil {
			mq, _ := json.Marshal(q)
			e.logger.Error("Failed to process query to multisearch request builder", "error", err, "query", string(mq), "queriesLength", len(queries), "duration", time.Since(start), "stage", es.StagePrepareRequest)
			response.Responses[q.RefID] = backend.ErrorResponseWithErrorSource(err)
			return response, nil
		}
	}

	req, err := ms.Build()
	if err != nil {
		mqs, _ := json.Marshal(e.dataQueries)
		e.logger.Error("Failed to build multisearch request", "error", err, "queriesLength", len(queries), "queries", string(mqs), "duration", time.Since(start), "stage", es.StagePrepareRequest)
		response.Responses[e.dataQueries[0].RefID] = backend.ErrorResponseWithErrorSource(err)
		return response, nil
	}

	e.logger.Info("Prepared request", "queriesLength", len(queries), "duration", time.Since(start), "stage", es.StagePrepareRequest)
	res, err := e.client.ExecuteMultisearch(req)
	if err != nil {
		if backend.IsDownstreamHTTPError(err) {
			err = backend.DownstreamError(err)
		}
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			// Unsupported protocol scheme is a common error when the URL is not valid and should be treated as a downstream error
			if urlErr.Err != nil && strings.HasPrefix(urlErr.Err.Error(), "unsupported protocol scheme") {
				err = backend.DownstreamError(err)
			}
		}
		response.Responses[e.dataQueries[0].RefID] = backend.ErrorResponseWithErrorSource(err)
		return response, nil
	}

	if res.Status >= 400 {
		statusErr := fmt.Errorf("unexpected status code: %d", res.Status)
		if backend.ErrorSourceFromHTTPStatus(res.Status) == backend.ErrorSourceDownstream {
			response.Responses[e.dataQueries[0].RefID] = backend.ErrorResponseWithErrorSource(backend.DownstreamError(statusErr))
		} else {
			response.Responses[e.dataQueries[0].RefID] = backend.ErrorResponseWithErrorSource(backend.PluginError(statusErr))
		}
		return response, nil
	}

	return parseResponse(e.ctx, res.Responses, queries, e.client.GetConfiguredFields(), e.keepLabelsInResponse, e.logger)
}

func (e *elasticsearchDataQuery) processQuery(q *Query, ms *es.MultiSearchRequestBuilder, from, to int64) error {
	err := isQueryWithError(q)
	if err != nil {
		return backend.DownstreamError(fmt.Errorf("received invalid query. %w", err))
	}

	defaultTimeField := e.client.GetConfiguredFields().TimeField
	b := ms.Search(q.Interval, q.TimeRange)
	b.Size(0)
	filters := b.Query().Bool().Filter()
	filters.AddDateRangeFilter(defaultTimeField, to, from, es.DateFormatEpochMS)
	filters.AddQueryStringFilter(q.RawQuery, true)

	if isLogsQuery(q) {
		processLogsQuery(q, b, from, to, defaultTimeField)
	} else if isDocumentQuery(q) {
		processDocumentQuery(q, b, from, to, defaultTimeField)
	} else {
		// Otherwise, it is a time series query and we process it
		processTimeSeriesQuery(q, b, from, to, defaultTimeField)
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
func (metricAggregation MetricAgg) generateSettingsForDSL() map[string]any {
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

func (bucketAgg BucketAgg) generateSettingsForDSL() map[string]any {
	setIntPath(bucketAgg.Settings, "min_doc_count")

	return bucketAgg.Settings.MustMap()
}

func addDateHistogramAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg, timeFrom, timeTo int64, timeField string) es.AggBuilder {
	// If no field is specified, use the time field
	field := bucketAgg.Field
	if field == "" {
		field = timeField
	}
	aggBuilder.DateHistogram(bucketAgg.ID, field, func(a *es.DateHistogramAgg, b es.AggBuilder) {
		var interval = bucketAgg.Settings.Get("interval").MustString("auto")
		if slices.Contains(es.GetCalendarIntervals(), interval) {
			a.CalendarInterval = interval
		} else {
			if interval == "auto" {
				// note this is not really a valid grafana-variable-handling,
				// because normally this would not match `$__interval_ms`,
				// but because how we apply these in the go-code, this will work
				// correctly, and becomes something like `500ms`.
				// a nicer way would be to use `${__interval_ms}ms`, but
				// that format is not recognized where we apply these variables
				// in the elasticsearch datasource
				a.FixedInterval = "$__interval_msms"
			} else {
				a.FixedInterval = interval
			}
		}
		a.MinDocCount = bucketAgg.Settings.Get("min_doc_count").MustInt(0)
		a.ExtendedBounds = &es.ExtendedBounds{Min: timeFrom, Max: timeTo}
		a.Format = bucketAgg.Settings.Get("format").MustString(es.DateFormatEpochMS)

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
		a.Interval = stringToFloatWithDefaultValue(bucketAgg.Settings.Get("interval").MustString(), 1000)
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
		} else {
			a.Size = stringToIntWithDefaultValue(bucketAgg.Settings.Get("size").MustString(), defaultSize)
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

func addNestedAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	aggBuilder.Nested(bucketAgg.ID, bucketAgg.Field, func(a *es.NestedAggregation, b es.AggBuilder) {
		aggBuilder = b
	})

	return aggBuilder
}

func addFiltersAgg(aggBuilder es.AggBuilder, bucketAgg *BucketAgg) es.AggBuilder {
	filters := make(map[string]any)
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
		a.Precision = stringToIntWithDefaultValue(bucketAgg.Settings.Get("precision").MustString(), es.DefaultGeoHashPrecision)
		aggBuilder = b
	})

	return aggBuilder
}

func getPipelineAggField(m *MetricAgg) string {
	// In frontend we are using Field as pipelineAggField
	// There might be historical reason why in backend we were using PipelineAggregate as pipelineAggField
	// So for now let's check Field first and then PipelineAggregate to ensure that we are not breaking anything
	// TODO: Investigate, if we can remove check for PipelineAggregate
	pipelineAggField := m.Field

	if pipelineAggField == "" {
		pipelineAggField = m.PipelineAggregate
	}
	return pipelineAggField
}

func isQueryWithError(query *Query) error {
	if len(query.BucketAggs) == 0 {
		// If no aggregations, only document and logs queries are valid
		if len(query.Metrics) == 0 || !(isLogsQuery(query) || isDocumentQuery(query)) {
			return fmt.Errorf("invalid query, missing metrics and aggregations")
		}
	}
	return nil
}

func isLogsQuery(query *Query) bool {
	return query.Metrics[0].Type == logsType
}

func isDocumentQuery(query *Query) bool {
	return isRawDataQuery(query) || isRawDocumentQuery(query)
}

func isRawDataQuery(query *Query) bool {
	return query.Metrics[0].Type == rawDataType
}

func isRawDocumentQuery(query *Query) bool {
	return query.Metrics[0].Type == rawDocumentType
}

func processLogsQuery(q *Query, b *es.SearchRequestBuilder, from, to int64, defaultTimeField string) {
	metric := q.Metrics[0]
	sort := es.SortOrderDesc
	if metric.Settings.Get("sortDirection").MustString() == "asc" {
		// This is currently used only for log context query
		sort = es.SortOrderAsc
	}
	b.Sort(sort, defaultTimeField, "boolean")
	b.Sort(sort, "_doc", "")
	b.AddDocValueField(defaultTimeField)
	// We need to add timeField as field with standardized time format to not receive
	// invalid formats that elasticsearch can parse, but our frontend can't (e.g. yyyy_MM_dd_HH_mm_ss)
	b.AddTimeFieldWithStandardizedFormat(defaultTimeField)
	b.Size(stringToIntWithDefaultValue(metric.Settings.Get("limit").MustString(), defaultSize))
	b.AddHighlight()

	// This is currently used only for log context query to get
	// log lines before and after the selected log line
	searchAfter := metric.Settings.Get("searchAfter").MustArray()
	for _, value := range searchAfter {
		b.AddSearchAfter(value)
	}

	// For log query, we add a date histogram aggregation
	aggBuilder := b.Agg()
	q.BucketAggs = append(q.BucketAggs, &BucketAgg{
		Type:  dateHistType,
		Field: defaultTimeField,
		ID:    "1",
		Settings: simplejson.NewFromAny(map[string]any{
			"interval": "auto",
		}),
	})
	bucketAgg := q.BucketAggs[0]
	bucketAgg.Settings = simplejson.NewFromAny(
		bucketAgg.generateSettingsForDSL(),
	)
	_ = addDateHistogramAgg(aggBuilder, bucketAgg, from, to, defaultTimeField)
}

func processDocumentQuery(q *Query, b *es.SearchRequestBuilder, from, to int64, defaultTimeField string) {
	metric := q.Metrics[0]
	b.Sort(es.SortOrderDesc, defaultTimeField, "boolean")
	b.Sort(es.SortOrderDesc, "_doc", "")
	b.AddDocValueField(defaultTimeField)
	if isRawDataQuery(q) {
		// For raw_data queries we need to add timeField as field with standardized time format to not receive
		// invalid formats that elasticsearch can parse, but our frontend can't (e.g. yyyy_MM_dd_HH_mm_ss)
		b.AddTimeFieldWithStandardizedFormat(defaultTimeField)
	}
	b.Size(stringToIntWithDefaultValue(metric.Settings.Get("size").MustString(), defaultSize))
}

func processTimeSeriesQuery(q *Query, b *es.SearchRequestBuilder, from, to int64, defaultTimeField string) {
	aggBuilder := b.Agg()
	// Process buckets
	// iterate backwards to create aggregations bottom-down
	for _, bucketAgg := range q.BucketAggs {
		bucketAgg.Settings = simplejson.NewFromAny(
			bucketAgg.generateSettingsForDSL(),
		)
		switch bucketAgg.Type {
		case dateHistType:
			aggBuilder = addDateHistogramAgg(aggBuilder, bucketAgg, from, to, defaultTimeField)
		case histogramType:
			aggBuilder = addHistogramAgg(aggBuilder, bucketAgg)
		case filtersType:
			aggBuilder = addFiltersAgg(aggBuilder, bucketAgg)
		case termsType:
			aggBuilder = addTermsAgg(aggBuilder, bucketAgg, q.Metrics)
		case geohashGridType:
			aggBuilder = addGeoHashGridAgg(aggBuilder, bucketAgg)
		case nestedType:
			aggBuilder = addNestedAgg(aggBuilder, bucketAgg)
		}
	}

	// Process metrics
	for _, m := range q.Metrics {
		m := m

		if m.Type == countType {
			continue
		}

		if isPipelineAgg(m.Type) {
			if isPipelineAggWithMultipleBucketPaths(m.Type) {
				if len(m.PipelineVariables) > 0 {
					bucketPaths := map[string]any{}
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
				pipelineAggField := getPipelineAggField(m)
				if _, err := strconv.Atoi(pipelineAggField); err == nil {
					var appliedAgg *MetricAgg
					for _, pipelineMetric := range q.Metrics {
						if pipelineMetric.ID == pipelineAggField {
							appliedAgg = pipelineMetric
							break
						}
					}
					if appliedAgg != nil {
						bucketPath := pipelineAggField
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
}

func stringToIntWithDefaultValue(valueStr string, defaultValue int) int {
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		value = defaultValue
	}
	// In our case, 0 is not a valid value and in this case we default to defaultValue
	if value == 0 {
		value = defaultValue
	}
	return value
}

func stringToFloatWithDefaultValue(valueStr string, defaultValue float64) float64 {
	value, err := strconv.ParseFloat(valueStr, 64)
	if err != nil {
		value = defaultValue
	}
	// In our case, 0 is not a valid value and in this case we default to defaultValue
	if value == 0 {
		value = defaultValue
	}
	return value
}
