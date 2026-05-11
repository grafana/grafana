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
		spec:   v0alpha1.UserSpec
		status: UserStatus
	}
	selectableFields: [
		"spec.email",
		"spec.login",
	]
	routes: {
		"/teams": {
			"GET": {
				name: "getUserTeams"
				response: {
					#UserTeam: {
						user:       string
						team:       string
						permission: string
						external:   bool
					}
					items: [...#UserTeam]
				}
				responseMetadata: listMeta: true
			}
		}
	}
}

UserStatus: {
	lastSeenAt: int64 | 0
	teamSync?:  TeamSyncStatus
}

TeamSyncStatus: {
	state:      "syncing" | "success" | "error" @cog(kind="enum",memberNames="Syncing|Success|Error")
	lastSyncAt: int64 | 0
}
