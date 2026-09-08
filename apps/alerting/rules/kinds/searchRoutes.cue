package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1/search"
)

// Three search contracts coexist during the storage migration.
//
// The alerting-owned per-kind compatibility endpoints
// ({resource}/searchRules) speak the generic per-resource search contract
// (search.grafana.app SearchQuery / SearchResults) while remaining distinct
// from the generic {resource}/search endpoints.
//
// searchRules is the cross-resource endpoint they supersede: one call searches
// both AlertRule and RecordingRule. Its request shape is modelled on the generic
// design for familiarity but is a separate contract, with its own TypeMeta, a
// string labelSelector, string sort fields, and a typed per-hit field union. It
// stays until clients move to the per-kind compatibility routes; nothing new
// should be built against it.

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
		// One alerting-owned compatibility endpoint per rule kind. The query is a
		// POST body (not query params) so the typed #SearchQuery tree survives the
		// transport.
		"/alertrules/searchRules": {
			POST: {
				// These search routes are experimental and subject to change without deprecation until stabilized
				// list rather than create because searching reads; the codegen
				// requires a Kubernetes verb prefix.
				name: "listAlertRuleSearchRulesV0alpha1"
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
		"/recordingrules/searchRules": {
			POST: {
				// These search routes are experimental and subject to change without deprecation until stabilized
				name: "listRecordingRuleSearchRulesV0alpha1"
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
