// Package search mirrors pkg/apis/search/v0alpha1 for alerting's per-kind
// /searchRules compatibility routes, including the search.grafana.app envelopes.
// Keep these schemas aligned with the generic contract.
package search

// Omitted fields default to title. All whitespace-separated terms must match
// in any order; punctuation and short-term matching are backend-defined.
#SearchTextLeaf: {
	value: string
	fields?: [...string]

	// boost is a future per-leaf score multiplier. Setting it is rejected.
	boost?: float64
}

#SearchFilterLeaf: {
	field:    string
	operator: "In" | "NotIn" | "All"
	values: [...string]
}

// Retained for generic schema compatibility; rejected by the compatibility handler.
#SearchRangeLeaf: {
	field: string
	gt?:   float64
	gte?:  float64
	lt?:   float64
	lte?:  float64
}

// Retained for generic schema compatibility; rejected by the compatibility handler.
#SearchExistsLeaf: {
	field: string
}

// Exactly one key must be set. The compatibility handler accepts only a
// text/filter leaf or a top-level "and" of those leaves.
#SearchWhereNode: {
	and?: [...#SearchWhereNode]
	or?: [...#SearchWhereNode]
	not?: #SearchWhereNode

	text?:   #SearchTextLeaf
	filter?: #SearchFilterLeaf
	range?:  #SearchRangeLeaf
	exists?: #SearchExistsLeaf
}

// Defaults to ascending; only scalar fields with the sort capability are valid.
#SearchSortField: {
	field:      string
	direction?: "asc" | "desc"
}

// Only In and NotIn are accepted by the compatibility handler.
#SearchLabelSelectorRequirement: {
	key:      string
	operator: "In" | "NotIn" | "Exists" | "DoesNotExist"
	values?: [...string]
}

// Selects metadata.labels, not alerting labels, and is ANDed with where.
// Filter alerting labels through the indexed "labels" field instead.
#SearchLabelSelector: {
	matchLabels?: [string]: string
	matchExpressions?: [...#SearchLabelSelectorRequirement]
}

// apiVersion and kind must identify search.grafana.app/v0alpha1 SearchQuery.
#SearchQuery: {
	apiVersion?: string
	kind?:       string

	// Omitted where matches all authorised rules satisfying labelSelector.
	where?: #SearchWhereNode

	labelSelector?: #SearchLabelSelector

	sort?: [...#SearchSortField]
	fields?: [...string]
	facets?: [...string]

	// Per-facet term limit. Zero uses the default; larger values are clamped.
	facetLimit?: int64

	// Page size. Zero uses the default; larger values are clamped.
	limit?: int64

	// Opaque token from the previous page.
	continue?: string
}

// Namespace is implicit in the URL.
#SearchResultResource: {
	group:    string
	resource: string
	kind:     string
	name:     string
}

#SearchResultHit: {
	resource: #SearchResultResource
	// Present only when a text query was evaluated.
	score?: float64

	// Open to match the generic endpoint's unstructured field values.
	fields?: {...}
}

// "eq" means exact; "lte" means totalHits is an upper bound after authorisation.
#TotalHitsRelation: "eq" | "lte"

#SearchResultsMetadata: {
	// Opaque next-page token; clients must not construct it.
	continue?: string

	// Interpret with totalHitsRelation, not as an exact count unconditionally.
	totalHits: int64

	totalHitsRelation: #TotalHitsRelation
}

#FacetValue: {
	value: string
	count: int64
}

#SearchResults: {
	metadata: #SearchResultsMetadata
	items: [...#SearchResultHit]

	// Counts use a bounded sample and are best-effort.
	facets?: [string]: [...#FacetValue]
}
