package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1/search"
)

// One endpoint per rule kind, speaking the generic per-resource search
// contract so the generic endpoint can take these routes over without a client
// change once rules are served from unified storage.

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
	}
}
