package schemaversion

import "github.com/grafana/grafana/apps/dashboard/pkg/migration/utils"

// V23 migrates multi variables to ensure their current property is aligned with their multi property.
// This migration ensures that variables with multi=true have current.value and current.text as arrays,
// and variables with multi=false have current.value and current.text as single values.
//
// Example before migration:
//
//	"templating": {
//	  "list": [
//	    { "type": "query", "multi": true, "current": { "value": "A", "text": "A" } },
//	    { "type": "query", "multi": false, "current": { "value": ["B"], "text": ["B"] } }
//	  ]
//	}
//
// Example after migration:
//
//	"templating": {
//	  "list": [
//	    { "type": "query", "multi": true, "current": { "value": ["A"], "text": ["A"] } },
//	    { "type": "query", "multi": false, "current": { "value": "B", "text": "B" } }
//	  ]
//	}
func V23(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 23

	templating, ok := dashboard["templating"].(map[string]interface{})
	if !ok {
		return nil
	}
	list, ok := templating["list"].([]interface{})
	if !ok {
		return nil
	}

	for _, v := range list {
		variable, ok := v.(map[string]interface{})
		if !ok {
			continue
		}

		if !isMulti(variable) {
			continue
		}

		current, ok := variable["current"].(map[string]interface{})
		if !ok {
			continue
		}

		if isEmptyObject(current) {
			continue
		}

		multi, ok := variable["multi"].(bool)
		if !ok {
			continue
		}

		variable["current"] = alignCurrentWithMulti(current, multi)
	}

	return nil
}

// isMulti checks if a variable supports multi-selection
func isMulti(variable map[string]interface{}) bool {
	_, hasMulti := variable["multi"]
	return hasMulti
}

// isEmptyObject checks if a value is an empty object
func isEmptyObject(value interface{}) bool {
	if value == nil {
		return true
	}

	obj, ok := value.(map[string]interface{})
	if !ok {
		return false
	}

	return len(obj) == 0
}

// alignCurrentWithMulti aligns the current property with the multi property
func alignCurrentWithMulti(current map[string]interface{}, multi bool) map[string]interface{} {
	if current == nil {
		return current
	}

	result := make(map[string]interface{})
	for k, v := range current {
		result[k] = v
	}

	if multi {
		// Convert single values to arrays
		if value, ok := result["value"]; ok {
			if !utils.IsArray(value) {
				result["value"] = []interface{}{value}
			}
		}
		if text, ok := result["text"]; ok {
			if !utils.IsArray(text) {
				result["text"] = []interface{}{text}
			}
		}
	} else {
		// Convert arrays to single values
		if value, ok := result["value"]; ok {
			if utils.IsArray(value) {
				if arr, ok := value.([]interface{}); ok && len(arr) > 0 {
					result["value"] = arr[0]
				} else {
					result["value"] = ""
				}
			}
		}
		if text, ok := result["text"]; ok {
			if utils.IsArray(text) {
				if arr, ok := text.([]interface{}); ok && len(arr) > 0 {
					result["text"] = arr[0]
				} else {
					result["text"] = ""
				}
			}
		}
	}

	return result
}
