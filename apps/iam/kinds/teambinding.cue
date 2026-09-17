package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

teambindingKind: {
	kind:       "TeamBinding"
	pluralName: "TeamBindings"
	codegen: {
		ts: {enabled: false}
		go: {enabled: true}
	}
}

teambindingv0alpha1: teambindingKind & {
	schema: {
		spec: v0alpha1.TeamBindingSpec
	}
	selectableFields: [
		"spec.teamRef.name",
		"spec.subject.name",
		"spec.external",
	]
	searchFields: [
		{
			name: "subject"
			path: "spec.subject.name"
			type: "string"
			capabilities: ["filter", "retrieve"]
		},
		{
			name: "team"
			path: "spec.teamRef.name"
			type: "string"
			capabilities: ["filter", "retrieve"]
		},
		{
			name: "permission"
			path: "spec.permission"
			type: "string"
			capabilities: ["retrieve"]
		},
		{
			name: "external"
			path: "spec.external"
			type: "boolean"
			capabilities: ["retrieve"]
			// Index the field even when the JSON omits it, so every team binding
			// carries a value like the original custom builder did.
			emitZeroIfAbsent: true
		},
	]
}
