package es

import (
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const (
	HighlightPreTagsString  = "@HIGHLIGHT@"
	HighlightPostTagsString = "@/HIGHLIGHT@"
	HighlightFragmentSize   = 2147483647
	DefaultGeoHashPrecision = 3

	termsOrderTerm = "_term"
)

type SortOrder string

const (
	SortOrderAsc  SortOrder = "asc"
	SortOrderDesc SortOrder = "desc"
)

// SearchRequestBuilder represents a builder which can build a search request
type SearchRequestBuilder struct {
	interval time.Duration
	index    string
	size     int
	// Currently sort is map, but based in examples it should be an array https://www.elastic.co/guide/en/elasticsearch/reference/current/sort-search-results.html
	sort         map[string]any
	queryBuilder *QueryBuilder
	aggBuilders  []AggBuilder
	customProps  map[string]any
	timeRange    backend.TimeRange
}

// NewSearchRequestBuilder create a new search request builder
func NewSearchRequestBuilder(interval time.Duration, timeRange backend.TimeRange) *SearchRequestBuilder {
	builder := &SearchRequestBuilder{
		interval:    interval,
		sort:        make(map[string]any),
		customProps: make(map[string]any),
		aggBuilders: make([]AggBuilder, 0),
		timeRange:   timeRange,
	}
	return builder
}

// Build builds and return a search request
func (b *SearchRequestBuilder) Build() (*SearchRequest, error) {
	sr := SearchRequest{
		Index:       b.index,
		TimeRange:   b.timeRange,
		Interval:    b.interval,
		Size:        b.size,
		Sort:        b.sort,
		CustomProps: b.customProps,
	}

	if b.queryBuilder != nil {
		q, err := b.queryBuilder.Build()
		if err != nil {
			return nil, err
		}
		sr.Query = q
	}

	if len(b.aggBuilders) > 0 {
		sr.Aggs = make(AggArray, 0)

		for _, ab := range b.aggBuilders {
			aggArray, err := ab.Build()
			if err != nil {
				return nil, err
			}
			sr.Aggs = append(sr.Aggs, aggArray...)
		}
	}

	return &sr, nil
}

// Size sets the size of the search request
func (b *SearchRequestBuilder) Size(size int) *SearchRequestBuilder {
	b.size = size
	return b
}

// Sort adds a "asc" | "desc" sort to the search request
func (b *SearchRequestBuilder) Sort(order SortOrder, field string, unmappedType string) *SearchRequestBuilder {
	if order != SortOrderAsc && order != SortOrderDesc {
		return b
	}

	props := map[string]string{
		"order": string(order),
	}

	if unmappedType != "" {
		props["unmapped_type"] = unmappedType
	}

	b.sort[field] = props

	return b
}

// AddTimeFieldWithStandardizedFormat adds a time field to fields with standardized time format
func (b *SearchRequestBuilder) AddTimeFieldWithStandardizedFormat(timeField string) *SearchRequestBuilder {
	b.customProps["fields"] = []map[string]string{{"field": timeField, "format": "strict_date_optional_time_nanos"}}
	return b
}

// AddDocValueField adds a doc value field to the search request
func (b *SearchRequestBuilder) AddDocValueField(field string) *SearchRequestBuilder {
	b.customProps["docvalue_fields"] = []string{field}

	b.customProps["script_fields"] = make(map[string]any)

	return b
}

// Add highlights to the search request for log queries
func (b *SearchRequestBuilder) AddHighlight() *SearchRequestBuilder {
	b.customProps["highlight"] = map[string]any{
		"fields": map[string]any{
			"*": map[string]any{},
		},
		"pre_tags":      []string{HighlightPreTagsString},
		"post_tags":     []string{HighlightPostTagsString},
		"fragment_size": HighlightFragmentSize,
	}
	return b
}

func (b *SearchRequestBuilder) AddSearchAfter(value any) *SearchRequestBuilder {
	if b.customProps["search_after"] == nil {
		b.customProps["search_after"] = []any{value}
	} else {
		b.customProps["search_after"] = append(b.customProps["search_after"].([]any), value)
	}

	return b
}

// Query creates and return a query builder
func (b *SearchRequestBuilder) Query() *QueryBuilder {
	if b.queryBuilder == nil {
		b.queryBuilder = NewQueryBuilder()
	}
	return b.queryBuilder
}

// Agg initiate and returns a new aggregation builder
func (b *SearchRequestBuilder) Agg() AggBuilder {
	aggBuilder := newAggBuilder()
	b.aggBuilders = append(b.aggBuilders, aggBuilder)
	return aggBuilder
}

// MultiSearchRequestBuilder represents a builder which can build a multi search request
type MultiSearchRequestBuilder struct {
	requestBuilders []*SearchRequestBuilder
}

// NewMultiSearchRequestBuilder creates a new multi search request builder
func NewMultiSearchRequestBuilder() *MultiSearchRequestBuilder {
	return &MultiSearchRequestBuilder{}
}

// Search initiates and returns a new search request builder
func (m *MultiSearchRequestBuilder) Search(interval time.Duration, timeRange backend.TimeRange) *SearchRequestBuilder {
	b := NewSearchRequestBuilder(interval, timeRange)
	m.requestBuilders = append(m.requestBuilders, b)
	return b
}

// Build builds and return a multi search request
func (m *MultiSearchRequestBuilder) Build() (*MultiSearchRequest, error) {
	requests := []*SearchRequest{}
	for _, sb := range m.requestBuilders {
		searchRequest, err := sb.Build()
		if err != nil {
			return nil, err
		}
		requests = append(requests, searchRequest)
	}

	return &MultiSearchRequest{
		Requests: requests,
	}, nil
}

// QueryBuilder represents a query builder
type QueryBuilder struct {
	boolQueryBuilder *BoolQueryBuilder
}

// NewQueryBuilder create a new query builder
func NewQueryBuilder() *QueryBuilder {
	return &QueryBuilder{}
}

// Build builds and return a query builder
func (b *QueryBuilder) Build() (*Query, error) {
	q := Query{}

	if b.boolQueryBuilder != nil {
		b, err := b.boolQueryBuilder.Build()
		if err != nil {
			return nil, err
		}
		q.Bool = b
	}

	return &q, nil
}

// Bool creates and return a query builder
func (b *QueryBuilder) Bool() *BoolQueryBuilder {
	if b.boolQueryBuilder == nil {
		b.boolQueryBuilder = NewBoolQueryBuilder()
	}
	return b.boolQueryBuilder
}

// BoolQueryBuilder represents a bool query builder
type BoolQueryBuilder struct {
	filterQueryBuilder *FilterQueryBuilder
}

// NewBoolQueryBuilder create a new bool query builder
func NewBoolQueryBuilder() *BoolQueryBuilder {
	return &BoolQueryBuilder{}
}

// Filter creates and return a filter query builder
func (b *BoolQueryBuilder) Filter() *FilterQueryBuilder {
	if b.filterQueryBuilder == nil {
		b.filterQueryBuilder = NewFilterQueryBuilder()
	}
	return b.filterQueryBuilder
}

// Build builds and return a bool query builder
func (b *BoolQueryBuilder) Build() (*BoolQuery, error) {
	boolQuery := BoolQuery{}

	if b.filterQueryBuilder != nil {
		filters, err := b.filterQueryBuilder.Build()
		if err != nil {
			return nil, err
		}
		boolQuery.Filters = filters
	}

	return &boolQuery, nil
}

// FilterQueryBuilder represents a filter query builder
type FilterQueryBuilder struct {
	filters []Filter
}

// NewFilterQueryBuilder creates a new filter query builder
func NewFilterQueryBuilder() *FilterQueryBuilder {
	return &FilterQueryBuilder{
		filters: make([]Filter, 0),
	}
}

// Build builds and return a filter query builder
func (b *FilterQueryBuilder) Build() ([]Filter, error) {
	return b.filters, nil
}

// AddDateRangeFilter adds a new time range filter
func (b *FilterQueryBuilder) AddDateRangeFilter(timeField string, lte, gte int64, format string) *FilterQueryBuilder {
	b.filters = append(b.filters, &RangeFilter{
		Key:    timeField,
		Lte:    lte,
		Gte:    gte,
		Format: format,
	})
	return b
}

// AddQueryStringFilter adds a new query string filter
func (b *FilterQueryBuilder) AddQueryStringFilter(querystring string, analyseWildcard bool) *FilterQueryBuilder {
	if len(strings.TrimSpace(querystring)) == 0 {
		return b
	}

	b.filters = append(b.filters, &QueryStringFilter{
		Query:           querystring,
		AnalyzeWildcard: analyseWildcard,
	})
	return b
}

// AggBuilder represents an aggregation builder
type AggBuilder interface {
	Histogram(key, field string, fn func(a *HistogramAgg, b AggBuilder)) AggBuilder
	DateHistogram(key, field string, fn func(a *DateHistogramAgg, b AggBuilder)) AggBuilder
	Terms(key, field string, fn func(a *TermsAggregation, b AggBuilder)) AggBuilder
	Nested(key, path string, fn func(a *NestedAggregation, b AggBuilder)) AggBuilder
	Filters(key string, fn func(a *FiltersAggregation, b AggBuilder)) AggBuilder
	GeoHashGrid(key, field string, fn func(a *GeoHashGridAggregation, b AggBuilder)) AggBuilder
	Metric(key, metricType, field string, fn func(a *MetricAggregation)) AggBuilder
	Pipeline(key, pipelineType string, bucketPath any, fn func(a *PipelineAggregation)) AggBuilder
	Build() (AggArray, error)
}

type aggBuilderImpl struct {
	AggBuilder
	aggDefs []*aggDef
}

func newAggBuilder() *aggBuilderImpl {
	return &aggBuilderImpl{
		aggDefs: make([]*aggDef, 0),
	}
}

func (b *aggBuilderImpl) Build() (AggArray, error) {
	aggs := make(AggArray, 0)

	for _, aggDef := range b.aggDefs {
		agg := &Agg{
			Key:         aggDef.key,
			Aggregation: aggDef.aggregation,
		}

		for _, cb := range aggDef.builders {
			childAggs, err := cb.Build()
			if err != nil {
				return nil, err
			}

			agg.Aggregation.Aggs = append(agg.Aggregation.Aggs, childAggs...)
		}

		aggs = append(aggs, agg)
	}

	return aggs, nil
}

func (b *aggBuilderImpl) Histogram(key, field string, fn func(a *HistogramAgg, b AggBuilder)) AggBuilder {
	innerAgg := &HistogramAgg{
		Field: field,
	}
	aggDef := newAggDef(key, &aggContainer{
		Type:        "histogram",
		Aggregation: innerAgg,
	})

	if fn != nil {
		builder := newAggBuilder()
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) DateHistogram(key, field string, fn func(a *DateHistogramAgg, b AggBuilder)) AggBuilder {
	innerAgg := &DateHistogramAgg{
		Field: field,
	}
	aggDef := newAggDef(key, &aggContainer{
		Type:        "date_histogram",
		Aggregation: innerAgg,
	})

	if fn != nil {
		builder := newAggBuilder()
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) Terms(key, field string, fn func(a *TermsAggregation, b AggBuilder)) AggBuilder {
	innerAgg := &TermsAggregation{
		Field: field,
		Order: make(map[string]any),
	}
	aggDef := newAggDef(key, &aggContainer{
		Type:        "terms",
		Aggregation: innerAgg,
	})

	if fn != nil {
		builder := newAggBuilder()
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	if len(innerAgg.Order) > 0 {
		if orderBy, exists := innerAgg.Order[termsOrderTerm]; exists {
			innerAgg.Order["_key"] = orderBy
			delete(innerAgg.Order, termsOrderTerm)
		}
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) Nested(key, field string, fn func(a *NestedAggregation, b AggBuilder)) AggBuilder {
	innerAgg := &NestedAggregation{
		Path: field,
	}
	aggDef := newAggDef(key, &aggContainer{
		Type:        "nested",
		Aggregation: innerAgg,
	})

	if fn != nil {
		builder := newAggBuilder()
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) Filters(key string, fn func(a *FiltersAggregation, b AggBuilder)) AggBuilder {
	innerAgg := &FiltersAggregation{
		Filters: make(map[string]any),
	}
	aggDef := newAggDef(key, &aggContainer{
		Type:        "filters",
		Aggregation: innerAgg,
	})
	if fn != nil {
		builder := newAggBuilder()
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) GeoHashGrid(key, field string, fn func(a *GeoHashGridAggregation, b AggBuilder)) AggBuilder {
	innerAgg := &GeoHashGridAggregation{
		Field:     field,
		Precision: DefaultGeoHashPrecision,
	}
	aggDef := newAggDef(key, &aggContainer{
		Type:        "geohash_grid",
		Aggregation: innerAgg,
	})

	if fn != nil {
		builder := newAggBuilder()
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) Metric(key, metricType, field string, fn func(a *MetricAggregation)) AggBuilder {
	innerAgg := &MetricAggregation{
		Type:     metricType,
		Field:    field,
		Settings: make(map[string]any),
	}

	aggDef := newAggDef(key, &aggContainer{
		Type:        metricType,
		Aggregation: innerAgg,
	})

	if fn != nil {
		fn(innerAgg)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) Pipeline(key, pipelineType string, bucketPath any, fn func(a *PipelineAggregation)) AggBuilder {
	innerAgg := &PipelineAggregation{
		BucketPath: bucketPath,
		Settings:   make(map[string]any),
	}
	aggDef := newAggDef(key, &aggContainer{
		Type:        pipelineType,
		Aggregation: innerAgg,
	})

	if fn != nil {
		fn(innerAgg)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}
