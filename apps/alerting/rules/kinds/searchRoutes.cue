package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1/search"
)

// One alerting-owned endpoint per rule kind, speaking the generic per-resource
// search contract on a distinct path so it can coexist with generic search
// during storage migration.

searchRoutes: {
	namespaced: {
		// The query is a POST body (not query params) so the typed #SearchQuery
		// tree survives the transport.
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
	}
}
