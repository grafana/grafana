package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

externalGroupMappingKind: {
	kind:       "ExternalGroupMapping"
	pluralName: "ExternalGroupMappings"
	codegen: {
		ts: {enabled: false}
		go: {enabled: true}
	}
}

externalGroupMappingv0alpha1: externalGroupMappingKind & {
	schema: {
		spec: v0alpha1.ExternalGroupMappingSpec
	}
	selectableFields: [
		"spec.teamRef.name",
		"spec.externalGroupId",
	]
	searchFields: [
		{
			name: "team"
			path: "spec.teamRef.name"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The team name associated with the external group mapping"
		},
		{
			name: "external_group"
			path: "spec.externalGroupId"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The external group name/id associated with the external group mapping"
		},
	]
}
