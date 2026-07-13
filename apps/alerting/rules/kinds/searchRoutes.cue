package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
)

// Generic pagination params shared by any paginated search endpoint.
#paginationQuery: {
	limit?:         int64
	continueToken?: string
}

#commonSearchQuery: {
	#paginationQuery
	q?: string
	names?: [...string]
	folders?: [...string]
	paused?: bool
	datasourceUIDs?: [...string]
	labels?: [...string]
	sort?: v0alpha1.#RuleSearchSortField
}

#alertRuleSearchQuery: {
	#commonSearchQuery
	dashboardUID?:     string
	panelID?:          int64
	receiver?:         string
	notificationType?: string
	routingTree?:      string
}

#recordingRuleSearchQuery: {
	#commonSearchQuery
	metric?:              string
	targetDatasourceUID?: string
}

// The cross-kind query is a pure superset of the per-kind queries plus the
// type discriminator used to optionally narrow results to a single kind.
#ruleSearchQuery: {
	#alertRuleSearchQuery
	#recordingRuleSearchQuery
	type?: string
}

searchRoutes: {
	namespaced: {
		// A single cross-kind search endpoint. Callers narrow to a single kind
		// with the optional "type" query param rather than hitting per-kind
		// routes.
		"/search": {
			GET: {
				// These search routes are experimental and subject to change without deprecation until stabilized
				name: "getSearchRules"
				request: {
					query: #ruleSearchQuery
				}
				response: {
					items: [...v0alpha1.#RuleHit]
				}
				responseMetadata: {
					typeMeta: true
					listMeta: true
				}
			}
		}
	}
}
