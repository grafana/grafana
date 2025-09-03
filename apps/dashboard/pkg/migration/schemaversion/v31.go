package schemaversion

import "context"

// V31 adds a merge transformer after any labelsToFields transformer in panel transformations.
//
// This migration addresses data processing workflow optimization by automatically inserting
// a merge transformation after the labelsToFields transformation. When the labelsToFields
// transformer converts time series labels to individual fields, it can result in multiple
// data frames that need to be consolidated for proper visualization and analysis.
//
// The migration works by:
// 1. Iterating through all panels in the dashboard, including nested panels in collapsed rows
// 2. Examining the transformations array within each panel
// 3. Identifying transformations with id 'labelsToFields'
// 4. Inserting a merge transformation with empty options immediately after each labelsToFields transformation
// 5. Preserving the original labelsToFields options (mode, keepLabels, valueLabel, etc.) without modification
// 6. Using empty options for merge transformations to enable optimal default consolidation behavior
// 7. Preserving the original order and configuration of all other transformations
//
// The migration handles complex scenarios including:
// - Multiple labelsToFields transformations within a single panel
// - Panels with mixed transformation types
// - Nested panels within collapsed row panels
// - Panels with no transformations (left unchanged)
// - Panels with transformations but no labelsToFields (left unchanged)
//
// Example transformation:
//
// Before migration:
//
//	panel: {
//	  "transformations": [
//	    { "id": "organize", "options": {} },
//	    { "id": "labelsToFields", "options": {} },
//	    { "id": "calculateField", "options": {} },
//	    { "id": "labelsToFields", "options": { "mode": "rows", "keepLabels": ["job", "instance"] } },
//	  ]
//	}
//
// After migration:
//
//	panel: {
//	  "transformations": [
//	    { "id": "organize", "options": {} },
//	    { "id": "labelsToFields", "options": {} },
//	    { "id": "merge", "options": {} },
//	    { "id": "calculateField", "options": {} },
//	    { "id": "labelsToFields", "options": { "mode": "rows", "keepLabels": ["job", "instance"] } },
//	    { "id": "merge", "options": {} }
//	  ]
//	}
func V31(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(31)

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	// Process all panels, including nested ones
	processPanelsV31(panels)

	return nil
}

// processPanelsV31 recursively processes panels, including nested panels within rows
func processPanelsV31(panels []interface{}) {
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
			processPanelsV31(nestedPanels)
			continue
		}

		transformations, ok := p["transformations"].([]interface{})
		if !ok {
			continue
		}

		// Check if we have any labelsToFields transformations
		hasLabelsToFields := false
		for _, transformation := range transformations {
			t, ok := transformation.(map[string]interface{})
			if !ok {
				continue
			}
			if t["id"] == "labelsToFields" {
				hasLabelsToFields = true
				break
			}
		}

		if !hasLabelsToFields {
			continue
		}

		// Create new transformations array with merge transformations added
		newTransformations := []interface{}{}

		for _, transformation := range transformations {
			t, ok := transformation.(map[string]interface{})
			if !ok {
				newTransformations = append(newTransformations, transformation)
				continue
			}

			// Add the current transformation (preserving all original options)
			newTransformations = append(newTransformations, transformation)

			// If this is a labelsToFields transformation, add a merge transformation after it
			// with empty options to enable optimal default consolidation behavior
			if t["id"] == "labelsToFields" {
				mergeTransformation := map[string]interface{}{
					"id":      "merge",
					"options": map[string]interface{}{},
				}
				newTransformations = append(newTransformations, mergeTransformation)
			}
		}

		// Update the panel with the new transformations
		p["transformations"] = newTransformations
	}
}
