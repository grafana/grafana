package kinds

import (
	v2beta1 "github.com/grafana/grafana/sdkkinds/dashboard/v2beta1"
)

globalVariableV2beta1: {
	kind:       "Variable"
	pluralName: "Variables"
	// API contract:
	// - spec.spec.name is the logical variable name input.
	// - metadata.annotations["grafana.app/folder"] carries optional folder scope.
	// - metadata.name may be omitted on CREATE; the server derives it as:
	//   - global: spec.spec.name
	//   - folder: spec.spec.name + "--" + folderUID
	// - when metadata.name is provided, it must match the derived value.
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
		spec: v2beta1.VariableKind
	}
}
