package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

teamKind: {
	kind:       "Team"
	pluralName: "Teams"
	current:    "v0alpha1"
	codegen: {
		ts: {enabled: false}
		go: {enabled: true}
	}
}

teamv0alpha1: teamKind & {
	schema: {
		spec: v0alpha1.TeamSpec
	}
	routes: {
		"/groups": {
			"GET": {
				name: "getTeamGroups"
				response: {
					externalGroups: [...string]
				}
				responseMetadata: objectMeta: false
			}
		}
		"/members": {
			"GET": {
				name: "getTeamMembers"
				response: {
					#TeamUser: {
						team:       string
						user:       string
						permission: string
						external:   bool
					}
					items: [...#TeamUser]
				}
			}
		}
		// 201 on fresh add, 200 on re-add. Re-add updates permission only; external is preserved.
		"/addmember": {
			"POST": {
				name: "createTeamMember"
				request: {
					body: {
						name:       string
						permission: string
						// external marks the membership origin: true = added by team sync, false = added manually. Honored on a fresh add only; on re-add the existing member's origin is preserved and this field is ignored.
						external: bool
					}
				}
				response: {
					team:       string
					user:       string
					permission: string
					// external reflects the stored origin of the membership after the operation. On a re-add this may differ from the value submitted in the request; clients that care about origin should diff request vs response.
					external: bool
				}
			}
		}
		"/removemember": {
			"POST": {
				name: "deleteTeamMember"
				request: {
					body: {
						name: string
					}
				}
				response: {
					team: string
					user: string
				}
			}
		}
	}
}
