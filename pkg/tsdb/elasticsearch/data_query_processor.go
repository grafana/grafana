package elasticsearch

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/components/simplejson"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

// processQuery processes a single query and adds it to the multi-search request builder
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

	// Handle raw DSL queries
	if q.RawDSLQuery.Query != nil {
		// Check for empty query
		if *q.RawDSLQuery.Query == "" {
			return backend.DownstreamError(fmt.Errorf("raw DSL query is empty"))
		}

		// Determine if we should extract aggregations from raw DSL
		shouldExtractAggregations := false
		// Extract aggregations only when explicitly requested via processAs="metrics"
		if q.RawDSLQuery.ProcessAs != nil && *q.RawDSLQuery.ProcessAs == "metrics" {
			shouldExtractAggregations = true
		}
		// For backward compatibility, if processAs is not set, use passthrough behavior (RawBody)

		if err := e.processRawDSLQuery(q, b, shouldExtractAggregations); err != nil {
			return err
		}
	}

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

// processLogsQuery processes a logs query and configures the search request accordingly
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

// processDocumentQuery processes a document query (raw_data or raw_document) and configures the search request
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

// processTimeSeriesQuery processes a time series query with aggregations and metrics
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

func (e *elasticsearchDataQuery) processRawDSLQuery(q *Query, b *es.SearchRequestBuilder, shouldExtractAggregations bool) error {
	if *q.RawDSLQuery.Query == "" {
		return backend.DownstreamError(fmt.Errorf("raw DSL query is empty"))
	}

	// Parse the raw DSL query JSON
	var queryBody map[string]any
	if err := json.Unmarshal([]byte(*q.RawDSLQuery.Query), &queryBody); err != nil {
		return backend.DownstreamError(fmt.Errorf("invalid raw DSL query JSON: %w", err))
	}

	if shouldExtractAggregations {
		// Extract aggregations for time series queries
		parser := NewAggregationParser()
		bucketAggs, metricAggs, err := parser.Parse(*q.RawDSLQuery.Query)
		if err != nil {
			return err
		}

		// If there is no metric agg that means it is count
		if len(metricAggs) == 0 {
			metricAggs = append(metricAggs, &MetricAgg{Type: "count"})
		}

		// Merge extracted aggregations into the query
		// Raw DSL aggregations take precedence - they replace existing aggregations
		if len(bucketAggs) > 0 {
			q.BucketAggs = bucketAggs
			q.Metrics = metricAggs
		}

		// Extract and apply the query part (not aggregations)
		if queryPart, ok := queryBody["query"].(map[string]any); ok {
			// Convert query part to JSON and set it as raw query string
			queryJSON, err := json.Marshal(queryPart)
			if err == nil {
				// Use the query from raw DSL instead of the query string filter
				q.RawQuery = string(queryJSON)
			}
		}
	} else {
		// For non-time-series queries (logs, raw data), pass through the raw body directly
		// This preserves the existing behavior for those query types
		b.SetRawBody(queryBody)
	}

	return nil
}

// getPipelineAggField returns the pipeline aggregation field
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
