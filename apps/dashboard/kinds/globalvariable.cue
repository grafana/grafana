package kinds

import (
	v2beta1 "github.com/grafana/grafana/sdkkinds/dashboard/v2beta1"
)

globalVariableV2beta1: {
	kind:       "GlobalVariable"
	pluralName: "GlobalVariables"
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
