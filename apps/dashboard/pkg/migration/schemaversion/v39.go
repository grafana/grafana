package schemaversion

import "context"

// V39 migrates timeSeriesTable transformation configuration to support extensible per-query options.
//
// This migration addresses limitations in the original timeSeriesTable transformation design where
// each query could only be configured with a single statistic function. The original refIdToStat
// format was too restrictive for evolving use cases that require multiple configuration parameters
// per query, such as custom formatting, aggregation methods, or display preferences.
//
// The migration works by:
// 1. Locating panels with timeSeriesTable transformations (including nested panels in rows)
// 2. Extracting the existing refIdToStat mapping from transformation options
// 3. Converting each refId-statistic pair to the new nested object structure
// 4. Preserving the statistic function while enabling future option expansion
// 5. Skipping transformations that lack valid refIdToStat configuration
//
// This restructuring enables future enhancements while maintaining backward compatibility:
// - Additional per-query options can be added without breaking existing configurations
// - The stat property preserves current functionality exactly as before
// - New features like custom labels, formats, or calculations can be added seamlessly
// - The structure scales better for complex multi-query transformations
//
// Example transformation:
//
// Before migration:
//
//	transformations: [{
//	  id: "timeSeriesTable",
//	  options: {
//	    refIdToStat: {
//	      "A": "mean",
//	      "B": "max",
//	      "C": "last"
//	    }
//	  }
//	}]
//
// After migration:
//
//	transformations: [{
//	  id: "timeSeriesTable",
//	  options: {
//	    "A": { stat: "mean" },
//	    "B": { stat: "max" },
//	    "C": { stat: "last" }
//	  }
//	}]
func V39(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(39)

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	// Process all panels, including nested ones
	processPanelsV39(panels)

	return nil
}

// processPanelsV39 recursively processes panels, including nested panels within rows
func processPanelsV39(panels []interface{}) {
	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		// Process nested panels if this is a row panel
		if p["type"] == "row" {
			if nestedPanels, ok := p["panels"].([]interface{}); ok {
				processPanelsV39(nestedPanels)
			}
			continue
		}

		transformations, ok := p["transformations"].([]interface{})
		if !ok {
			continue
		}

		for _, transformation := range transformations {
			t, ok := transformation.(map[string]interface{})
			if !ok {
				continue
			}

			// If we run into a timeSeriesTable transformation
			// and it doesn't have undefined options then we migrate
			if t["id"] != "timeSeriesTable" {
				continue
			}

			options, ok := t["options"].(map[string]interface{})
			if !ok {
				continue
			}

			refIdStats, ok := options["refIdToStat"].(map[string]interface{})
			if !ok {
				continue
			}

			// For each {refIdtoStat} record which maps refId to a statistic
			// we add that to the stat property of the new
			// RefIdTransformerOptions interface which includes multiple settings
			transformationOptions := make(map[string]interface{})
			for refId, stat := range refIdStats {
				transformationOptions[refId] = map[string]interface{}{"stat": stat}
			}

			// Update the options
			t["options"] = transformationOptions
		}
	}
}
