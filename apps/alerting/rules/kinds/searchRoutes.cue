package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1/search"
)

// Per-kind /searchRules routes reserve /search for generic search.
// The cross-kind /searchRules contract remains until clients migrate.

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
		"/alertrules/searchRules": {
			POST: {
				// These search routes are experimental and subject to change without deprecation until stabilized
				// Codegen requires a Kubernetes verb prefix; search is a read.
				name: "listAlertRuleSearchRulesV0alpha1"
				request: {
					body: search.#SearchQuery
				}
				// SearchResults supplies its own metadata; omit listMeta.
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
