package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

teamKind: {
	kind:       "Team"
	pluralName: "Teams"
	current:    "v0alpha1"
	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}
}

teamv0alpha1: teamKind & {
	schema: {
		spec: v0alpha1.TeamSpec
	}
	routes: {
		"/groups": {
			"GET": {
				response: {
					#ExternalGroupMapping: {
						name: string
						externalGroup: string
					}
					items: [...#ExternalGroupMapping]
				}
				responseMetadata: objectMeta: false
			}
		}
		"/search": {
			"GET": {
				request: {
					query: { 
						query?: string
					}
				}
				response: {
					#TeamHit: {
						name: string
						title: string
						email: string
						provisioned: bool
						externalUID: string
					}
					offset: int64
					totalHits: int64
					hits: [...#TeamHit]
					queryCost: float64
					maxScore: float64
				}
				responseMetadata: objectMeta: false
			}
		}
	}
}
