package dashboard

import (
	"fmt"
	"strings"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
)

// walkVariableKinds traverses the VariableSpec union in a single pass and
// returns the spec name of whichever kind is populated (empty if none) along
// with the total number of populated kinds. Centralising the walk here keeps
// the name-extraction and kind-counting use cases from drifting when a new
// variable kind is added to the union: the new case only needs a single
// entry in this function.
func walkVariableKinds(spec dashv2.VariableSpec) (name string, count int) {
	if spec.QueryVariableKind != nil {
		name = spec.QueryVariableKind.Spec.Name
		count++
	}
	if spec.TextVariableKind != nil {
		name = spec.TextVariableKind.Spec.Name
		count++
	}
	if spec.ConstantVariableKind != nil {
		name = spec.ConstantVariableKind.Spec.Name
		count++
	}
	if spec.DatasourceVariableKind != nil {
		name = spec.DatasourceVariableKind.Spec.Name
		count++
	}
	if spec.IntervalVariableKind != nil {
		name = spec.IntervalVariableKind.Spec.Name
		count++
	}
	if spec.CustomVariableKind != nil {
		name = spec.CustomVariableKind.Spec.Name
		count++
	}
	if spec.GroupByVariableKind != nil {
		name = spec.GroupByVariableKind.Spec.Name
		count++
	}
	if spec.AdhocVariableKind != nil {
		name = spec.AdhocVariableKind.Spec.Name
		count++
	}
	if spec.SwitchVariableKind != nil {
		name = spec.SwitchVariableKind.Spec.Name
		count++
	}
	return name, count
}

func getVariableName(spec dashv2.VariableSpec) string {
	name, _ := walkVariableKinds(spec)
	return name
}

func validateVariable(variable *dashv2.Variable) error {
	if variable == nil {
		return fmt.Errorf("variable payload is required")
	}

	name, count := walkVariableKinds(variable.Spec)
	if count != 1 {
		return fmt.Errorf("variable spec must include exactly one variable kind")
	}

	if name == "" {
		return fmt.Errorf("variable name must not be empty")
	}

	if strings.HasPrefix(name, "__") {
		return fmt.Errorf("variable name %q must not start with '__' (reserved for built-in macros)", name)
	}

	return nil
}
