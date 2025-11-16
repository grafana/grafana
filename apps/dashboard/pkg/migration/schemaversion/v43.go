package schemaversion

import "context"

// V43 migrates formatTime transformations to convertFieldType transformations.
//
// The formatTime transformation is being replaced by the more comprehensive convertFieldType
// transformation. The convertFieldType transformation includes all the functionality of formatTime
// and much more, making formatTime redundant.
//
// This migration works by:
// 1. Iterating through all panels in the dashboard, including nested panels in collapsed rows
// 2. Examining the transformations array within each panel
// 3. Identifying transformations with id 'formatTime'
// 4. Converting each formatTime transformation to a convertFieldType transformation
// 5. Mapping the formatTime options to equivalent convertFieldType options
// 6. Preserving all other transformations unchanged
//
// The option mapping is as follows:
// - formatTime.timeField -> convertFieldType.conversions[0].targetField
// - formatTime.outputFormat -> convertFieldType.conversions[0].dateFormat
// - formatTime.timezone -> convertFieldType.conversions[0].timezone
// - destinationType is set to "string" since formatTime always converts to string
//
// Example transformation:
//
// Before migration:
//
//	panel: {
//	  "transformations": [
//	    { "id": "organize", "options": {} },
//	    { "id": "formatTime", "options": { "timeField": "timestamp", "outputFormat": "YYYY-MM-DD", "timezone": "UTC" } },
//	    { "id": "calculateField", "options": {} }
//	  ]
//	}
//
// After migration:
//
//	panel: {
//	  "transformations": [
//	    { "id": "organize", "options": {} },
//	    {
//	      "id": "convertFieldType",
//	      "options": {
//	        "conversions": [{
//	          "targetField": "timestamp",
//	          "destinationType": "string",
//	          "dateFormat": "YYYY-MM-DD",
//	          "timezone": "UTC"
//	        }]
//	      }
//	    },
//	    { "id": "calculateField", "options": {} }
//	  ]
//	}
func V43(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(43)

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	// Process all panels, including nested ones
	processPanelsV43(panels)

	return nil
}

// processPanelsV43 recursively processes panels, including nested panels within rows
func processPanelsV43(panels []interface{}) {
	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		// Process nested panels if this is a row panel
		if p["type"] == "row" {
			nestedPanels, hasNested := p["panels"].([]interface{})
			if !hasNested {
				continue
			}
			processPanelsV43(nestedPanels)
			continue
		}

		transformations, ok := p["transformations"].([]interface{})
		if !ok {
			continue
		}

		// Check if we have any formatTime transformations
		hasFormatTime := false
		for _, transformation := range transformations {
			t, ok := transformation.(map[string]interface{})
			if !ok {
				continue
			}
			if t["id"] == "formatTime" {
				hasFormatTime = true
				break
			}
		}

		if !hasFormatTime {
			continue
		}

		// Create new transformations array with formatTime converted to convertFieldType
		newTransformations := []interface{}{}

		for _, transformation := range transformations {
			t, ok := transformation.(map[string]interface{})
			if !ok {
				newTransformations = append(newTransformations, transformation)
				continue
			}

			// If this is a formatTime transformation, convert it to convertFieldType
			if t["id"] == "formatTime" {
				convertedTransformation := convertFormatTimeToConvertFieldType(t)
				newTransformations = append(newTransformations, convertedTransformation)
			} else {
				// Keep other transformations unchanged
				newTransformations = append(newTransformations, transformation)
			}
		}

		// Update the panel with the new transformations
		p["transformations"] = newTransformations
	}
}

// convertFormatTimeToConvertFieldType converts a formatTime transformation to convertFieldType
func convertFormatTimeToConvertFieldType(formatTimeTransformation map[string]interface{}) map[string]interface{} {
	// Get the formatTime options
	formatTimeOptions, ok := formatTimeTransformation["options"].(map[string]interface{})
	if !ok {
		formatTimeOptions = map[string]interface{}{}
	}

	// Create the conversion object
	conversion := map[string]interface{}{
		"destinationType": "string",
	}

	// Map timeField to targetField
	if timeField, ok := formatTimeOptions["timeField"].(string); ok && timeField != "" {
		conversion["targetField"] = timeField
	}

	// Map outputFormat to dateFormat
	if outputFormat, ok := formatTimeOptions["outputFormat"].(string); ok && outputFormat != "" {
		conversion["dateFormat"] = outputFormat
	}

	// Map timezone
	if timezone, ok := formatTimeOptions["timezone"].(string); ok && timezone != "" {
		conversion["timezone"] = timezone
	}

	// Create the convertFieldType transformation
	convertFieldTypeTransformation := map[string]interface{}{
		"id": "convertFieldType",
		"options": map[string]interface{}{
			"conversions": []interface{}{conversion},
		},
	}

	return convertFieldTypeTransformation
}
