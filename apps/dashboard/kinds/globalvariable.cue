package kinds

import (
	v2 "github.com/grafana/grafana/sdkkinds/dashboard/v2"
)

globalVariableV2: {
	kind:       "Variable"
	pluralName: "Variables"
	selectableFields: [
		"spec.spec.name",
	]
	validation: {
		operations: ["CREATE", "UPDATE"]
	}
	mutation: {
		operations: ["CREATE", "UPDATE"]
	}
	schema: {
		spec: v2.VariableKind
	}
}
