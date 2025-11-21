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
		"teams/search": {
			"GET": {
				request: {
					query: { 
						query?: string // team name query string
					}
				}
				response: { // response schema
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
				// turn off object metadata in the response schema (both objectMeta and typeMeta default to true, and we want to leave typeMeta on)
				responseMetadata: objectMeta: false
			}
		}
	}
}
