package schemaversion

import (
	"context"
)

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
func V23(_ context.Context, dashboard map[string]interface{}) error {
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
// This matches the frontend's alignCurrentWithMulti function behavior
func alignCurrentWithMulti(current map[string]interface{}, multi bool) map[string]interface{} {
	if current == nil {
		return current
	}

	result := make(map[string]interface{})
	for k, v := range current {
		result[k] = v
	}

	if multi {
		convertToArrays(result)
	} else {
		convertToSingleValues(result)
	}

	return result
}

// convertToArrays converts single values to arrays (match frontend behavior)
// Frontend only converts when current.value is NOT an array
func convertToArrays(result map[string]interface{}) {
	value, hasValue := result["value"]
	if !hasValue || IsArray(value) {
		return
	}

	// Convert value to array
	result["value"] = []interface{}{value}

	// Only convert text to array when we're converting value
	if text, ok := result["text"]; ok && !IsArray(text) {
		result["text"] = []interface{}{text}
	}
}

// convertToSingleValues converts arrays to single values (both value and text must be single values)
func convertToSingleValues(result map[string]interface{}) {
	convertArrayToSingle(result, "value")
	convertArrayToSingle(result, "text")
}

// convertArrayToSingle converts an array field to a single value
func convertArrayToSingle(result map[string]interface{}, key string) {
	value, ok := result[key]
	if !ok || !IsArray(value) {
		return
	}

	arr, ok := value.([]interface{})
	if !ok {
		result[key] = ""
		return
	}

	if len(arr) > 0 {
		result[key] = arr[0]
	} else {
		result[key] = ""
	}
}
