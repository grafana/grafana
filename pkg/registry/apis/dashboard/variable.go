package dashboard

import (
	"fmt"
	"strings"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

func getVariableName(spec dashv2beta1.VariableSpec) string {
	switch {
	case spec.QueryVariableKind != nil:
		return spec.QueryVariableKind.Spec.Name
	case spec.TextVariableKind != nil:
		return spec.TextVariableKind.Spec.Name
	case spec.ConstantVariableKind != nil:
		return spec.ConstantVariableKind.Spec.Name
	case spec.DatasourceVariableKind != nil:
		return spec.DatasourceVariableKind.Spec.Name
	case spec.IntervalVariableKind != nil:
		return spec.IntervalVariableKind.Spec.Name
	case spec.CustomVariableKind != nil:
		return spec.CustomVariableKind.Spec.Name
	case spec.GroupByVariableKind != nil:
		return spec.GroupByVariableKind.Spec.Name
	case spec.AdhocVariableKind != nil:
		return spec.AdhocVariableKind.Spec.Name
	case spec.SwitchVariableKind != nil:
		return spec.SwitchVariableKind.Spec.Name
	default:
		return ""
	}
}

func countVariableKinds(spec dashv2beta1.VariableSpec) int {
	count := 0
	if spec.QueryVariableKind != nil {
		count++
	}
	if spec.TextVariableKind != nil {
		count++
	}
	if spec.ConstantVariableKind != nil {
		count++
	}
	if spec.DatasourceVariableKind != nil {
		count++
	}
	if spec.IntervalVariableKind != nil {
		count++
	}
	if spec.CustomVariableKind != nil {
		count++
	}
	if spec.GroupByVariableKind != nil {
		count++
	}
	if spec.AdhocVariableKind != nil {
		count++
	}
	if spec.SwitchVariableKind != nil {
		count++
	}
	return count
}

func validateVariable(variable *dashv2beta1.Variable) error {
	if variable == nil {
		return fmt.Errorf("variable payload is required")
	}

	if countVariableKinds(variable.Spec) != 1 {
		return fmt.Errorf("variable spec must include exactly one variable kind")
	}

	name := getVariableName(variable.Spec)
	if name == "" {
		return fmt.Errorf("variable name must not be empty")
	}

	if strings.HasPrefix(name, "__") {
		return fmt.Errorf("variable name %q must not start with '__' (reserved for built-in macros)", name)
	}

	return nil
}
