package schemaversion

import "context"

// V6 migration handles the pulldowns to annotations conversion and template variable updates.
// This migration moves annotations from the legacy pulldowns array to the new annotations structure
// and updates template variables to use the new schema format.
//
// Background:
// In earlier versions, dashboards used a "pulldowns" property array to store various UI elements
// including annotations. This migration extracts annotations from pulldowns and creates the new
// annotations structure. It also updates template variables to ensure proper datasource handling
// and type normalization.
//
// Example before migration:
// {
//   "schemaVersion": 5,
//   "pulldowns": [
//     { "type": "filtering", "enable": true },
//     { "type": "annotations", "enable": true, "annotations": [{"name": "old"}] }
//   ],
//   "templating": {
//     "list": [
//       { "name": "server", "type": "filter" },
//       { "name": "metric", "datasource": undefined, "allFormat": undefined }
//     ]
//   }
// }
//
// Example after migration:
// {
//   "schemaVersion": 6,
//   "annotations": {
//     "list": [{"name": "old"}]
//   },
//   "templating": {
//     "list": [
//       { "name": "server", "type": "query", "datasource": null },
//       { "name": "metric", "type": "query", "datasource": null }
//     ]
//   }
// }

func V6(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 6

	// Move drop-downs to new schema (matches frontend DashboardMigrator logic)
	// Find annotations in pulldowns array: equivalent to find(old.pulldowns, { type: 'annotations' })
	if pulldowns, ok := dashboard["pulldowns"].([]interface{}); ok {
		for _, pulldownInterface := range pulldowns {
			if pulldown, ok := pulldownInterface.(map[string]interface{}); ok {
				if pulldownType, exists := pulldown["type"]; exists && pulldownType == "annotations" {
					// Found annotations pulldown, extract annotations
					if annotations, hasAnnotations := pulldown["annotations"]; hasAnnotations {
						dashboard["annotations"] = map[string]interface{}{
							"list": annotations,
						}
					} else {
						// If no annotations property, create empty list
						dashboard["annotations"] = map[string]interface{}{
							"list": []interface{}{},
						}
					}
					break // Found what we're looking for, no need to continue
				}
			}
		}
	}

	// Update template variables
	if templating, ok := dashboard["templating"].(map[string]interface{}); ok {
		if list, ok := templating["list"].([]interface{}); ok {
			for _, variableInterface := range list {
				if variable, ok := variableInterface.(map[string]interface{}); ok {
					// If datasource is undefined/missing, set to null
					if _, exists := variable["datasource"]; !exists {
						variable["datasource"] = nil
					}

					// Convert 'filter' type to 'query'
					if varType, exists := variable["type"]; exists && varType == "filter" {
						variable["type"] = "query"
					}

					// If type is undefined/missing, set to 'query'
					if _, exists := variable["type"]; !exists {
						variable["type"] = "query"
					}

					// Remove allFormat if it's undefined
					if allFormat, exists := variable["allFormat"]; exists && allFormat == nil {
						delete(variable, "allFormat")
					}
				}
			}
		}
	}

	return nil
}
