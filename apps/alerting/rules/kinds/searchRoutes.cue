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
	groups?: [...string]
	paused?: bool
	datasourceUIDs?: [...string]
	labels?: [...string]
	sort?: v0alpha1.#RuleSearchSortField
	// Fields to count distinct terms for (e.g. "folder"). Returned under
	// "facets" keyed by field name. Facet terms are ordered by count, not
	// alphabetically.
	facet?: [...string]
	// Max terms returned per facet (default 50, max 1000).
	facetLimit?: int64
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
		"/search/alertrules": {
			GET: {
				// These search routes are experimental and subject to change without deprecation until stabilized
				name: "getSearchAlertRules"
				request: {
					query: #alertRuleSearchQuery
				}
				response: {
					items: [...v0alpha1.#AlertRuleHit]
					facets?: [string]: v0alpha1.#FacetResult
				}
				responseMetadata: {
					typeMeta: true
					listMeta: true
				}
			}
		}
		"/search/recordingrules": {
			GET: {
				// These search routes are experimental and subject to change without deprecation until stabilized
				name: "getSearchRecordingRules"
				request: {
					query: #recordingRuleSearchQuery
				}
				response: {
					items: [...v0alpha1.#RecordingRuleHit]
					facets?: [string]: v0alpha1.#FacetResult
				}
				responseMetadata: {
					typeMeta: true
					listMeta: true
				}
			}
		}
		"/search": {
			GET: {
				// These search routes are experimental and subject to change without deprecation until stabilized
				name: "getSearchRules"
				request: {
					query: #ruleSearchQuery
				}
				response: {
					items: [...v0alpha1.#RuleHit]
					facets?: [string]: v0alpha1.#FacetResult
				}
				responseMetadata: {
					typeMeta: true
					listMeta: true
				}
			}
		}
	}
}
