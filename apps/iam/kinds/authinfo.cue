package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

authInfoKind: {
	kind:       "AuthInfo"
	pluralName: "AuthInfos"
	codegen: {
		ts: {enabled: false}
		go: {enabled: true}
	}
}

authInfov0alpha1: authInfoKind & {
	schema: {
		spec: v0alpha1.AuthInfoSpec
	}
	selectableFields: [
		"spec.userRef.name",
		"spec.authModule",
		"spec.authID",
	]
	searchFields: [
		{
			name: "user"
			path: "spec.userRef.name"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The UID of the user this auth link belongs to"
		},
		{
			name: "authModule"
			path: "spec.authModule"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The external auth provider the user is linked through"
		},
		{
			name: "authID"
			path: "spec.authID"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The identifier the auth provider returns at login"
		},
		{
			name: "externalUID"
			path: "spec.externalUID"
			type: "string"
			capabilities: ["retrieve"]
			description: "The external unique identifier of the user"
		},
	]
}
