package es

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const (
	HighlightPreTagsString  = "@HIGHLIGHT@"
	HighlightPostTagsString = "@/HIGHLIGHT@"
	HighlightFragmentSize   = 2147483647
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
	// rawBody contains the raw Elasticsearch Query DSL JSON for raw DSL queries
	rawBody map[string]any
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
		RawBody:     b.rawBody,
	}

	// If RawBody is set, skip building query and aggs as they're in the raw body
	if len(b.rawBody) > 0 {
		return &sr, nil
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

// AddCustomProp adds a custom property to the search request
func (b *SearchRequestBuilder) AddCustomProp(key string, value any) *SearchRequestBuilder {
	b.customProps[key] = value
	return b
}

// SetRawBody sets the raw Elasticsearch Query DSL body directly
// This bypasses all builder logic and sends the query as-is to Elasticsearch
func (b *SearchRequestBuilder) SetRawBody(rawBody map[string]any) *SearchRequestBuilder {
	b.rawBody = rawBody
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

