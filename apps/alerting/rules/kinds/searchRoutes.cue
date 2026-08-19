package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1/search"
)

// Two search contracts live here while the first is migrated onto the second.
//
// The per-kind endpoints ({resource}/search, defined in the imported search
// package) are the target: one endpoint per rule kind, speaking the generic
// per-resource search contract (search.grafana.app SearchQuery / SearchResults)
// exactly, so the generic endpoint can take them over without a client change
// once rules are served from unified storage. They are declared here first and
// served in a follow-up; until then a call to one gets a 404.
//
// searchRules is the cross-resource endpoint they supersede: one call searches
// both AlertRule and RecordingRule. Its request shape is modelled on the generic
// design for familiarity but is a separate contract, with its own TypeMeta, a
// string labelSelector, string sort fields, and a typed per-hit field union. It
// stays until its handler moves to the per-kind routes, and is removed with it;
// nothing new should be built against it.

// #SearchTextLeaf is a free-text search across one or more text-capable
// fields. When fields is omitted, the kind's default text field set is used.
// A match requires every whitespace-separated term of value to appear in the
// field, in any order. How very short terms, punctuation, and common words are
// matched is backend-defined and may change.
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

// #SearchQuery is the search request body, modelled on
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
		// One endpoint per rule kind, at the paths and operation IDs the generic
		// search API uses, so a generated client keeps the same symbols when the
		// generic endpoint takes over. The query is a POST body (not query params)
		// so the typed #SearchQuery tree survives the transport.
		"/alertrules/search": {
			POST: {
				// These search routes are experimental and subject to change without deprecation until stabilized
				// list rather than create because searching reads; the codegen
				// requires a Kubernetes verb prefix and this is the one the generic
				// API uses for the same route.
				name: "listAlertRuleSearchV0alpha1"
				request: {
					body: search.#SearchQuery
				}
				// listMeta is intentionally omitted: #SearchResults carries its
				// own metadata (continue, totalHits).
				response: search.#SearchResults
				responseMetadata: {
					typeMeta: true
				}
			}
		}
		"/recordingrules/search": {
			POST: {
				// These search routes are experimental and subject to change without deprecation until stabilized
				name: "listRecordingRuleSearchV0alpha1"
				request: {
					body: search.#SearchQuery
				}
				response: search.#SearchResults
				responseMetadata: {
					typeMeta: true
				}
			}
		}

		// Superseded by the two routes above. The query is a POST body (not query
		// params) so the typed #SearchQuery tree survives the transport.
		"/searchRules": {
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
				// own metadata (continue, totalHits).
				response: v0alpha1.#SearchResults
				responseMetadata: {
					typeMeta: true
				}
			}
		}
	}
}
