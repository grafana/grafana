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
	//TODO:
	// Adding selectableFields here causes the codegen to fail because it's a union parent path.
	// Until grafana-app-sdk supports selectableFields through union parent paths, 
	// we're not adding it here and patching the manifest.go file instead with 
	// apps/dashboard/cuehack/patch_variable_selectable_fields.sh
	//  selectableFields: [ 
	// 	"spec.spec.name",
	// ] 
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
