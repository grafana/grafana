package kinds

import (
	v2beta1 "github.com/grafana/grafana/sdkkinds/dashboard/v2beta1"
	v2 "github.com/grafana/grafana/sdkkinds/dashboard/v2"
)

// The Variable kind is served at v2beta1 and v2 with identical specs, so every
// version must share these declarations. Otherwise validation, mutation and
// field selectors would accept a request in one version and reject it in another.
_globalVariable: {
	kind:       "Variable"
	pluralName: "Variables"
	search: {
		global: true
	}
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
}

globalVariableV2beta1: _globalVariable & {
	schema: {
		spec: v2beta1.VariableKind
	}
}

globalVariableV2: _globalVariable & {
	schema: {
		spec: v2.VariableKind
	}
}
