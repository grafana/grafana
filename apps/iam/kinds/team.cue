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
					#ExternalGroupMapping: {
						name:          string
						externalGroup: string
					}
					items: [...#ExternalGroupMapping]
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
		// 201 Created on fresh add, 200 OK on idempotent re-add or remove.
		"/addmember": {
			"POST": {
				name: "createTeamMember"
				request: {
					body: {
						name:       string
						permission: string
						external:   bool
					}
				}
				response: {
					team:       string
					user:       string
					permission: string
					external:   bool
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
