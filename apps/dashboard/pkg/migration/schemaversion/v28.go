package schemaversion

import (
	"context"
)

// V28 removes deprecated variable properties (tags, tagsQuery, tagValuesQuery, useTags)
//
// Example before migration:
//
//	 {
//		"templating": {
//		  "list": [
//		    { "name": "var1", "tags": ["tag1"], "tagsQuery": "query", "tagValuesQuery": "values", "useTags": true }
//		  ]
//		}
//	}
//
// Example after migration:
//
//	{
//		"templating": {
//		  "list": [
//		    { "name": "var1" }
//		  ]
//		}
//	}
func V28(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 28

	// Remove deprecated variable properties
	if templating, ok := dashboard["templating"].(map[string]interface{}); ok {
		if list, ok := templating["list"].([]interface{}); ok {
			for _, v := range list {
				if variable, ok := v.(map[string]interface{}); ok {
					removeDeprecatedVariableProperties(variable)
				}
			}
		}
	}

	return nil
}

// removeDeprecatedVariableProperties removes deprecated properties from variables
// Based on DashboardMigrator.ts v28 migration: variable property cleanup
func removeDeprecatedVariableProperties(variable map[string]interface{}) {
	// Remove deprecated properties
	delete(variable, "tags")

	// Only remove tagsQuery if it's a non-empty string (matches frontend behavior)
	if tagsQuery, exists := variable["tagsQuery"]; exists {
		if str, ok := tagsQuery.(string); ok && str != "" {
			delete(variable, "tagsQuery")
		}
	}

	// Only remove tagValuesQuery if it's a non-empty string (matches frontend behavior)
	if tagValuesQuery, exists := variable["tagValuesQuery"]; exists {
		if str, ok := tagValuesQuery.(string); ok && str != "" {
			delete(variable, "tagValuesQuery")
		}
	}

	// Only remove useTags if it's a truthy boolean (matches frontend behavior)
	if useTags, exists := variable["useTags"]; exists {
		if val, ok := useTags.(bool); ok && val {
			delete(variable, "useTags")
		}
	}
}
