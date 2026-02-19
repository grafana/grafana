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
	SelectableFields: [
		"spec.teamRef.name",
		"spec.externalGroupId",
	]
}
