// Package search is the per-kind rule search contract: one search endpoint per
// rule kind, mounted where the generic per-resource search API mounts its own,
// POST .../namespaces/{ns}/{resource}/search.
//
// Everything here mirrors search.grafana.app/v0alpha1 SearchQuery and
// SearchResults (pkg/apis/search/v0alpha1/types.go) field for field, and the
// envelopes carry that group's apiVersion and kind. The point is that adopting
// the generic endpoint later is a wiring change rather than a breaking one, so
// nothing here may diverge: anything added has to be added to the generic types
// first.
//
// The generic endpoint cannot serve rules until they live in unified storage.
// For dual-writer modes 0-3 they come from the legacy ngalert store, whose
// filtering, ordering and paging capabilities the generic query translator
// cannot express, so the contract is duplicated here and served by a
// rules-specific handler.
//
// This lives in its own package so the generic-shaped contract stays isolated
// from the rule kind schemas it is temporarily served alongside.
package search

// #SearchTextLeaf is a free-text predicate against one or more text-capable
// fields. When fields is omitted, the kind's default text field set is used
// (today: title). A match requires every whitespace-separated term of value to
// appear in the field, in any order. How very short terms, punctuation, and
// common words are matched is backend-defined and may change.
#SearchTextLeaf: {
	value: string
	fields?: [...string]

	// boost is a future per-leaf score multiplier. Setting it is rejected.
	boost?: float64
}

// #SearchFilterLeaf matches a single field against a set of values.
#SearchFilterLeaf: {
	field:    string
	operator: "In" | "NotIn"
	values: [...string]
}

// #SearchRangeLeaf is a future numeric/date range predicate. Modelled for
// schema stability; always rejected today.
#SearchRangeLeaf: {
	field: string
	gt?:   float64
	gte?:  float64
	lt?:   float64
	lte?:  float64
}

// #SearchExistsLeaf is a future field-existence predicate. Modelled for schema
// stability; always rejected today.
#SearchExistsLeaf: {
	field: string
}

// #SearchWhereNode is a single node of the where query tree. Exactly one key
// must be set, and the set key names the node's type. Combinators (and/or/not)
// compose other nodes; leaves (text/filter/range/exists) are terminal
// predicates.
//
// Every node type is modelled so the schema is future-proof, but only a narrow
// subset is accepted: a single top-level leaf, or one "and" over text and
// filter leaves. Everything else is rejected. or, not, range and exists are
// sketched for future versions and always rejected today.
#SearchWhereNode: {
	// Combinators.
	and?: [...#SearchWhereNode]
	or?: [...#SearchWhereNode]
	not?: #SearchWhereNode

	// Leaves.
	text?:   #SearchTextLeaf
	filter?: #SearchFilterLeaf
	range?:  #SearchRangeLeaf
	exists?: #SearchExistsLeaf
}

// #SearchSortField names a field to sort by and a direction, defaulting to
// ascending. Only fields declaring the sort capability may be named, and only
// scalar ones: sorting on a list of values has no defined meaning.
#SearchSortField: {
	field:      string
	direction?: "asc" | "desc"
}

// #SearchLabelSelectorRequirement is one metadata label requirement, mirroring
// metav1.LabelSelectorRequirement. Only In and NotIn are accepted; Exists and
// DoesNotExist are modelled for schema stability and rejected.
#SearchLabelSelectorRequirement: {
	key:      string
	operator: "In" | "NotIn" | "Exists" | "DoesNotExist"
	values?: [...string]
}

// #SearchLabelSelector filters on the resource's metadata.labels, mirroring
// metav1.LabelSelector. It is ANDed with where. Note this selects resource
// metadata labels, not the rules' own alerting labels: those are filtered
// through a where filter leaf on the indexed "labels" field.
#SearchLabelSelector: {
	matchLabels?: [string]: string
	matchExpressions?: [...#SearchLabelSelectorRequirement]
}

// #SearchQuery is the search request body, mirroring search.grafana.app
// SearchQuery. apiVersion and kind identify the envelope and are validated
// against search.grafana.app/v0alpha1 and "SearchQuery".
#SearchQuery: {
	apiVersion?: string
	kind?:       string

	// where is the search predicate tree. Omitting it matches every rule of the
	// kind, subject to labelSelector and per-rule authorisation.
	where?: #SearchWhereNode

	labelSelector?: #SearchLabelSelector

	sort?: [...#SearchSortField]
	fields?: [...string]
	facets?: [...string]

	// facetLimit caps the number of terms returned per facet, for every entry in
	// facets. Zero uses the server default; larger values are clamped.
	facetLimit?: int64

	// limit is the page size. Zero uses the default; larger values are clamped.
	limit?: int64

	// continue is an opaque paging token from a previous page.
	continue?: string
}

// #SearchResultResource is the full identity of a hit. The namespace is implicit
// from the URL and omitted.
#SearchResultResource: {
	group:    string
	resource: string
	kind:     string
	name:     string
}

// #SearchResultHit is a single match: its identity, an optional relevance score
// (present only when a text query was evaluated), and the requested fields.
#SearchResultHit: {
	resource: #SearchResultResource
	score?:   float64

	// fields holds the JSON values for the requested (or default) fields.
	// Deliberately an open object rather than a per-kind union: the generic
	// endpoint returns the field values unstructured, so declaring them here
	// would make the schema narrow now and widen at migration.
	fields?: {...}
}

// #TotalHitsRelation says how totalHits relates to the real number of matching
// rules the caller may see: "eq" when it is exact, "lte" when it is an upper
// bound because authorisation was applied after the search ranked its results.
#TotalHitsRelation: "eq" | "lte"

// #SearchResultsMetadata carries the paging token and total authorised match
// count.
#SearchResultsMetadata: {
	// continue is an opaque token for the next page. Clients must not inspect or
	// construct it.
	continue?: string

	// totalHits counts the rules matching the query. Always read it together
	// with totalHitsRelation, which says whether the count is exact.
	totalHits: int64

	totalHitsRelation: #TotalHitsRelation
}

// #FacetValue is a single facet term and its count.
#FacetValue: {
	value: string
	count: int64
}

// #SearchResults is the response envelope. It carries
// search.grafana.app/v0alpha1 SearchResults in its own apiVersion/kind so the
// wire response does not change when the generic endpoint takes over.
#SearchResults: {
	metadata: #SearchResultsMetadata
	items: [...#SearchResultHit]

	// facets holds term counts per requested facet field. Counts are computed
	// over a bounded sample window, so they are best-effort.
	facets?: [string]: [...#FacetValue]
}
