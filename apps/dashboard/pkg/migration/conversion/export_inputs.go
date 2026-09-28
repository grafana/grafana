package conversion

import "strings"

// resolveConstantExportInputs substitutes ${VAR_*} placeholders produced by the
// classic "Export for sharing externally" flow with the constant values embedded
// in the dashboard's top-level __inputs section.
//
// Those exports are import templates: the exporter moves each constant variable's
// value into __inputs and replaces the variable's query/current with a
// "${VAR_<NAME>}" placeholder, expecting the import API to resolve it. A template
// written through any other path (Terraform's grafana_dashboard resource,
// provisioning, a direct POST) is stored verbatim as v0alpha1 with __inputs intact.
// The placeholder must therefore be resolved here, when the raw v0 spec is
// canonicalized to v1, before the schema migration drops __inputs and the constant
// value is no longer recoverable.
//
// Only constant inputs are resolved: they map to a plain value substitution.
// DS_* inputs carry no value to substitute, and __elements (library panels) would
// need a library-element resource recreated (a side effect); both are out of scope.
func resolveConstantExportInputs(dash map[string]interface{}) {
	inputs, ok := dash["__inputs"].([]interface{})
	if !ok || len(inputs) == 0 {
		return
	}

	replacements := map[string]string{}
	for _, raw := range inputs {
		input, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		name, _ := input["name"].(string)
		value, hasValue := input["value"].(string)
		if input["type"] == "constant" && name != "" && hasValue {
			replacements["${"+name+"}"] = value
		}
	}
	if len(replacements) == 0 {
		return
	}

	for key, child := range dash {
		// the input definitions themselves keep their placeholder-free values
		if key == "__inputs" {
			continue
		}
		dash[key] = substituteExportPlaceholders(child, replacements)
	}
}

func substituteExportPlaceholders(node interface{}, replacements map[string]string) interface{} {
	switch v := node.(type) {
	case string:
		for placeholder, value := range replacements {
			v = strings.ReplaceAll(v, placeholder, value)
		}
		return v
	case map[string]interface{}:
		for key, child := range v {
			v[key] = substituteExportPlaceholders(child, replacements)
		}
		return v
	case []interface{}:
		for i, child := range v {
			v[i] = substituteExportPlaceholders(child, replacements)
		}
		return v
	default:
		return node
	}
}
