package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1/search"
)

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
	}
}
