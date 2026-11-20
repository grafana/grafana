package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1/search"
)

// Version routes rather than kind routes: a route under alertrules/ would
// shadow the resource. The generic per-kind /search endpoint is left to the
// unified index; these also serve rules from legacy storage.
searchRoutes: {
	namespaced: {
		"/searchAlertRules": {
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
		"/searchRecordingRules": {
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
