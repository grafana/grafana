package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
)

// The search request body mirrors the generic per-resource search design
// (SearchQuery under search.grafana.app) so this rules-specific surface can
// converge onto the shared type once the generic endpoint lands. See the
// "Per-resource search proposal" design doc for the canonical shape.

// #SearchTextLeaf is a free-text search across one or more text-capable
// fields. When fields is omitted, the kind's default text field set is used.
#SearchTextLeaf: {
	value: string
	fields?: [...string]
}

// #SearchFilterLeaf matches a single field against a set of values.
#SearchFilterLeaf: {
	field:    string
	operator: "In" | "NotIn"
	values: [...string]
}

// #SearchWhereNode is a single node of the where query tree. A node has
// exactly one key naming its type. v1 supports a top-level "and" combinator
// plus the "text" and "filter" leaves; "or"/"not"/nesting and the "range"/
// "exists" leaves are future, additive extensions.
#SearchWhereNode: {
	and?: [...#SearchWhereNode]
	text?:   #SearchTextLeaf
	filter?: #SearchFilterLeaf
}

// #SearchSortField selects a result ordering. A leading "-" denotes
// descending. Each field must be declared sortable in the kind's manifest.
#SearchSortField: string

// #SearchQuery is the search request body, mirroring
// search.grafana.app SearchQuery.
#SearchQuery: {
	where?:         #SearchWhereNode
	labelSelector?: string
	sort?: [...#SearchSortField]
	fields?: [...string]
	facets?: [...string]
	limit?:    int64
	continue?: string
}

searchRoutes: {
	namespaced: {
		// A single per-resource search endpoint. Its request/response shapes
		// mirror the generic search.grafana.app SearchQuery/SearchResults. The
		// query is a POST body (not query params) so the typed #SearchQuery
		// tree survives the transport, matching the generic design.
		"/search": {
			POST: {
				// These search routes are experimental and subject to change without deprecation until stabilized
				// Named with the create* prefix because the codegen requires a
				// Kubernetes verb prefix and POST maps to create; the route is a
				// read-only search despite the verb.
				name: "createSearchRules"
				request: {
					body: #SearchQuery
				}
				// listMeta is intentionally omitted: #SearchResults carries its
				// own metadata (continue, totalHits) mirroring the generic
				// search.grafana.app SearchResults envelope.
				response: v0alpha1.#SearchResults
				responseMetadata: {
					typeMeta: true
				}
			}
		}
	}
}
