package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	GROUP      = "search.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION

	// KindSearchQuery and friends are the envelope kinds carried in the
	// request/response TypeMeta. Each endpoint accepts one request kind and
	// rejects the other.
	KindSearchQuery   = "SearchQuery"
	KindSearchResults = "SearchResults"
	KindTrashQuery    = "TrashQuery"
	KindTrashResults  = "TrashResults"

	// Here rather than beside the routes because the authorization chain needs
	// them and cannot depend on the handler package.
	SearchPathSegment = "search"
	TrashPathSegment  = "trash"
)

// WhereNode is a single node of the where tree. Exactly one field must be set;
// the set field names the node's type. Combinators (and/or/not) compose other
// nodes, leaves (text/filter/range/exists) are terminal predicates.
//
// All node types are modelled so the schema is future-proof, but v1 only
// accepts a narrow subset (top-level single leaf or a single and of leaves;
// text, filter and range leaves; In/NotIn/All filter operators). Everything else is
// rejected with 422 Unprocessable Entity by the validation layer. exists is
// sketched for a future version and always rejected today.
//
// +k8s:deepcopy-gen=true
type WhereNode struct {
	// Combinators.
	And []WhereNode `json:"and,omitempty"`
	Or  []WhereNode `json:"or,omitempty"`
	Not *WhereNode  `json:"not,omitempty"`

	// Leaves.
	Text   *TextPredicate   `json:"text,omitempty"`
	Filter *FilterPredicate `json:"filter,omitempty"`
	Range  *RangePredicate  `json:"range,omitempty"`
	Exists *ExistsPredicate `json:"exists,omitempty"` // future, rejected in v1
}

// TextPredicate is a free-text predicate against one or more text-capable
// fields. When Fields is empty it defaults to the kind's searchTextFields
// (currently ["title"]).
//
// +k8s:deepcopy-gen=true
type TextPredicate struct {
	Value  string   `json:"value"`
	Fields []string `json:"fields,omitempty"`
	// Boost is a future per-leaf score multiplier. Setting it is rejected in v1.
	Boost *float64 `json:"boost,omitempty"`
}

// FilterPredicate is an exact / set-based predicate against a single field.
// Values are strings whatever the field's declared type, so a boolean field
// takes "true" or "false" and a numeric field takes the number written out.
//
// Numbers are held as float64, so only integers up to 2^53 are compared exactly.
// Past that, values a whole number apart share one representation, and a filter
// can both match a neighbour and miss the value asked for.
//
// +k8s:deepcopy-gen=true
type FilterPredicate struct {
	Field string `json:"field"`
	// Operator is "In", "NotIn" or "All" in v1. "In" matches any of the values,
	// "NotIn" excludes all of them, and "All" requires the field to hold every
	// value, which only a field holding a list of values can do.
	Operator string   `json:"operator"`
	Values   []string `json:"values"`
}

// RangePredicate compares a numeric field against one or two bounds. At least
// one bound is required, gt cannot be combined with gte, and lt cannot be
// combined with lte. Boolean and string fields are rejected: only numbers have
// the order a range asks about. On an integer field a bound must be whole.
//
// Bounds are held as float64, so only integers up to 2^53 are compared exactly.
// Past that, values a whole number apart share one representation, and a bound
// can both admit a neighbour and exclude the value asked for.
//
// +k8s:deepcopy-gen=true
type RangePredicate struct {
	Field string   `json:"field"`
	GT    *float64 `json:"gt,omitempty"`
	GTE   *float64 `json:"gte,omitempty"`
	LT    *float64 `json:"lt,omitempty"`
	LTE   *float64 `json:"lte,omitempty"`
}

// ExistsPredicate is a future field-existence predicate. Modelled for schema
// stability; always rejected in v1.
//
// +k8s:deepcopy-gen=true
type ExistsPredicate struct {
	Field string `json:"field"`
}

// SortField names a field to sort by and a direction ("asc" or "desc"). V1
// allows sorting only on scalar string and numeric fields that declare the sort
// capability.
//
// +k8s:deepcopy-gen=true
type SortField struct {
	Field     string `json:"field"`
	Direction string `json:"direction,omitempty"`
}

// SearchQuery is the request body for POST .../{resource}/search.
//
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SearchQuery struct {
	metav1.TypeMeta `json:",inline"`

	// Where is the search predicate tree. Omitting it matches all resources of
	// the kind (subject to labelSelector and per-item authz).
	Where *WhereNode `json:"where,omitempty"`

	// LabelSelector filters on metadata.labels, ANDed with Where.
	LabelSelector *metav1.LabelSelector `json:"labelSelector,omitempty"`

	Sort   []SortField `json:"sort,omitempty"`
	Fields []string    `json:"fields,omitempty"`
	Facets []string    `json:"facets,omitempty"`

	// FacetLimit caps the number of terms returned per facet. It applies to
	// every entry in Facets. Zero uses the server default; values above the
	// server cap are clamped.
	FacetLimit int64 `json:"facetLimit,omitempty"`

	// Limit is the page size. Zero uses the default; values above the maximum
	// are clamped.
	Limit int64 `json:"limit,omitempty"`

	// Continue is an opaque pagination token from a previous page.
	Continue string `json:"continue,omitempty"`
}

// TrashQuery is the request body for POST .../{resource}/trash. It is a
// deliberately smaller subset of SearchQuery: trash documents index only the
// standard fields, so there is no labelSelector and no faceting. Field
// references are restricted to the fixed trash field set.
//
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TrashQuery struct {
	metav1.TypeMeta `json:",inline"`

	Where *WhereNode `json:"where,omitempty"`

	Sort   []SortField `json:"sort,omitempty"`
	Fields []string    `json:"fields,omitempty"`

	Limit    int64  `json:"limit,omitempty"`
	Continue string `json:"continue,omitempty"`
}

// SearchResults is the response body for POST .../{resource}/search.
//
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SearchResults struct {
	metav1.TypeMeta `json:",inline"`

	Metadata ResultsMetadata `json:"metadata"`
	Items    []ResultItem    `json:"items"`

	// Facets holds term counts per requested facet field. Counts are computed
	// over a bounded sample window, so they are best-effort/approximate.
	Facets map[string][]FacetTerm `json:"facets,omitempty"`
}

// TrashResults is the response body for POST .../{resource}/trash. It has the
// same item shape as SearchResults but never carries facets.
//
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TrashResults struct {
	metav1.TypeMeta `json:",inline"`

	Metadata ResultsMetadata `json:"metadata"`
	Items    []ResultItem    `json:"items"`
}

// TotalHitsRelation says how ResultsMetadata.TotalHits relates to the real
// number of matching resources the caller is allowed to see.
type TotalHitsRelation string

const (
	// TotalHitsEqual means TotalHits is the exact count.
	TotalHitsEqual TotalHitsRelation = "eq"

	// TotalHitsAtMost means TotalHits is an upper bound: the real count is less
	// than or equal to it. The server falls back to this when counting exactly
	// would be too expensive.
	TotalHitsAtMost TotalHitsRelation = "lte"
)

// ResultsMetadata carries the pagination token and the total hit count.
//
// +k8s:deepcopy-gen=true
type ResultsMetadata struct {
	Continue string `json:"continue,omitempty"`

	// TotalHits counts the resources matching the query. Always read it together
	// with TotalHitsRelation, which says whether the count is exact.
	TotalHits int64 `json:"totalHits"`

	// TotalHitsRelation is "eq" when TotalHits is exact and "lte" when it is an
	// upper bound.
	TotalHitsRelation TotalHitsRelation `json:"totalHitsRelation"`
}

// ResultItem is one search or trash hit. The item shape is identical on both
// endpoints; only which fields the Fields map can carry differs.
//
// +k8s:deepcopy-gen=true
type ResultItem struct {
	Resource ResourceRef `json:"resource"`

	// Score is present only when a text query was evaluated. A pointer so a real
	// score of 0 is still distinguishable from "no text query" (absent).
	Score *float64 `json:"score,omitempty"`

	// Fields holds the JSON values for the requested (or default) fields.
	// Array-typed fields are returned as JSON arrays. Absent fields are omitted.
	Fields *common.Unstructured `json:"fields,omitempty"`
}

// ResourceRef is the full identity of a returned item. Namespace is implicit
// from the URL and omitted.
//
// +k8s:deepcopy-gen=true
type ResourceRef struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Kind     string `json:"kind"`
	Name     string `json:"name"`
}

// FacetTerm is a single facet term and its count.
//
// +k8s:deepcopy-gen=true
type FacetTerm struct {
	Value string `json:"value"`
	Count int64  `json:"count"`
}
