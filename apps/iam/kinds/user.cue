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
	// createdAt mirrors the standard document's Created value into the per-kind
	// fields and is declared in Go, not here, because it reads from a standard
	// field rather than a resource path.
	searchFields: [
		{
			name: "email"
			path: "spec.email"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The email address of the user"
		},
		{
			name: "login"
			path: "spec.login"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The login of the user"
		},
		{
			name: "lastSeenAt"
			path: "status.lastSeenAt"
			type: "int64"
			capabilities: ["sort", "retrieve"]
			// Sort on last-seen puts missing values last; index the zero value so
			// never-seen users keep their historical epoch-0 sort position.
			emitZeroIfAbsent: true
			description:      "The last seen timestamp of the user"
		},
		{
			name: "role"
			path: "spec.role"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The role of the user"
		},
		{
			name: "disabled"
			path: "spec.disabled"
			type: "boolean"
			capabilities: ["filter", "retrieve"]
			emitZeroIfAbsent: true
			description:      "Whether the user is disabled"
		},
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
