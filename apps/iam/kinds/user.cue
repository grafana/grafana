package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

userKind: {
	kind:       "User"
	pluralName: "Users"
	codegen: {
		ts: {enabled: false}
		go: {enabled: true}
	}
}

userv0alpha1: userKind & {
	schema: {
		spec: v0alpha1.UserSpec
		status: {
			lastSeenAt: int64 | 0
		}
	}
	selectableFields: [
		"spec.email",
		"spec.login",
	]
	routes: {
		"/teams": {
			"GET": {
				response: {
					#UserTeam: {
						user: string
						team: string
						permission: string
						external: bool
					}
					items: [...#UserTeam]
				}
			}
		}
	}
}
