package v0alpha1

// The request/response shapes below mirror the generic per-resource search
// design (SearchQuery / SearchResults under search.grafana.app) so this
// rules-specific surface can converge onto the shared types with minimal
// churn once the generic endpoint lands. See the "Per-resource search
// proposal" design doc for the canonical shape.

// #SearchResultResource is the full identity of a hit.
#SearchResultResource: {
	group:    string
	resource: string
	kind:     string
	name:     string
}

// #RuleSearchHitFields is the per-kind field payload returned on each hit.
// It carries the union of alert- and recording-rule search fields; only the
// fields relevant to a hit's kind are populated. This maps to the kind's
// declared searchFields.
#RuleSearchHitFields: {
	title?:    string
	folder?:   string
	type?:     string
	interval?: string
	paused?:   bool
	labels?: [string]: string
	datasourceUIDs?: [...string]

	// Alert-rule fields.
	annotations?: [string]: string
	"for"?:            string
	keepFiringFor?:    string
	dashboardUID?:     string
	panelID?:          int64
	receiver?:         string
	notificationType?: string
	routingTree?:      string

	// Recording-rule fields.
	metric?:              string
	targetDatasourceUID?: string
}

// #SearchResultHit is a single match: its identity, an optional relevance
// score (present only when the query included free text), and the requested
// fields.
#SearchResultHit: {
	resource: #SearchResultResource
	score?:   float64
	fields:   #RuleSearchHitFields
}

// #SearchResultsMetadata carries the paging token and total authorised match
// count.
#SearchResultsMetadata: {
	continue?:  string
	totalHits?: int64
}

// #FacetValue is a single value/count pair in a facet breakdown.
#FacetValue: {
	value: string
	count: int64
}

// #SearchResults is the response envelope, mirroring
// search.grafana.app SearchResults.
#SearchResults: {
	metadata: #SearchResultsMetadata
	items: [...#SearchResultHit]
	facets?: [string]: [...#FacetValue]
}
