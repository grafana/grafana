package dashboard

import "strings"

// resolveConstantExportInputs substitutes ${VAR_*} placeholders produced by
// the classic "Export for sharing externally" flow with the default values
// embedded in the dashboard's top-level __inputs section.
//
// Such exports are import templates: the exporter moves each constant
// variable's value into __inputs and replaces the variable's query/current
// with a "${VAR_<NAME>}" placeholder. Only the import API resolves those
// placeholders, so dashboards written through the regular save APIs (e.g.
// Terraform, provisioning, direct HTTP calls) would otherwise persist the
// literal placeholder and later lose the original value when __inputs is
// dropped during schema migration.
//
// Only constant inputs are resolved: they are the only input type that
// carries its value in the export. Datasource inputs have no default and are
// left untouched.
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
		// never rewrite the input definitions themselves
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
