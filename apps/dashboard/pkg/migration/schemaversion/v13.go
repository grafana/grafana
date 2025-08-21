package schemaversion

// V13 migrates dashboards from schema version 12 to 13.
// This migration updates graph panel thresholds from the old grid.threshold1/threshold2 format
// to the new thresholds array format.
//
// Before (v12):
//
//	"grid": {
//	  "threshold1": 80,
//	  "threshold1Color": "#d44a3a",
//	  "threshold2": 90,
//	  "threshold2Color": "#d44a3a",
//	  "thresholdLine": true
//	}
//
// After (v13):
//
//	"thresholds": [
//	  {
//	    "value": 80,
//	    "line": true,
//	    "lineColor": "#d44a3a",
//	    "colorMode": "custom"
//	  },
//	  {
//	    "value": 90,
//	    "line": true,
//	    "lineColor": "#d44a3a",
//	    "colorMode": "custom"
//	  }
//	]
func V13(dash map[string]interface{}) error {
	panels, ok := dash["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, p := range panels {
		panel, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		// Only process graph panels
		panelType, ok := panel["type"].(string)
		if !ok || panelType != "graph" {
			continue
		}

		// Check if grid exists
		grid, ok := panel["grid"].(map[string]interface{})
		if !ok {
			continue
		}

		// Get existing thresholds or initialize empty array
		existingThresholds, ok := panel["thresholds"].([]interface{})
		if !ok {
			existingThresholds = []interface{}{}
		}

		// Create new thresholds array for migrated thresholds
		newThresholds := []interface{}{}

		// Copy existing thresholds without modification
		for _, t := range existingThresholds {
			// Create a copy of the threshold to avoid modifying the original
			thresholdCopy := make(map[string]interface{})
			for k, v := range t.(map[string]interface{}) {
				thresholdCopy[k] = v
			}
			newThresholds = append(newThresholds, thresholdCopy)
		}

		// Process threshold1
		if threshold1, ok := grid["threshold1"]; ok && threshold1 != nil {
			t1 := map[string]interface{}{
				"value": threshold1,
			}

			if thresholdLine, ok := grid["thresholdLine"].(bool); ok && thresholdLine {
				t1["line"] = true
				if color, ok := grid["threshold1Color"].(string); ok {
					t1["lineColor"] = color
				}
				t1["colorMode"] = "custom"
			} else {
				t1["fill"] = true
				if color, ok := grid["threshold1Color"].(string); ok {
					t1["fillColor"] = color
				}
				t1["colorMode"] = "custom"
			}

			newThresholds = append(newThresholds, t1)
		}

		// Process threshold2
		if threshold2, ok := grid["threshold2"]; ok && threshold2 != nil {
			t2 := map[string]interface{}{
				"value": threshold2,
			}

			if thresholdLine, ok := grid["thresholdLine"].(bool); ok && thresholdLine {
				t2["line"] = true
				if color, ok := grid["threshold2Color"].(string); ok {
					t2["lineColor"] = color
				}
				t2["colorMode"] = "custom"
			} else {
				t2["fill"] = true
				if color, ok := grid["threshold2Color"].(string); ok {
					t2["fillColor"] = color
				}
				t2["colorMode"] = "custom"
			}

			newThresholds = append(newThresholds, t2)
		}

		// Set operation based on threshold values
		if len(newThresholds) == 2 {
			// Get threshold values for comparison
			t1Value, t1Ok := newThresholds[0].(map[string]interface{})["value"]
			t2Value, t2Ok := newThresholds[1].(map[string]interface{})["value"]

			if t1Ok && t2Ok {
				// Convert to float64 for comparison
				var t1Float, t2Float float64
				switch v := t1Value.(type) {
				case float64:
					t1Float = v
				case int:
					t1Float = float64(v)
				case int64:
					t1Float = float64(v)
				default:
					continue
				}

				switch v := t2Value.(type) {
				case float64:
					t2Float = v
				case int:
					t2Float = float64(v)
				case int64:
					t2Float = float64(v)
				default:
					continue
				}

				// Set operation based on threshold values (following frontend logic)
				if t1Float > t2Float {
					newThresholds[0].(map[string]interface{})["op"] = "lt"
					newThresholds[1].(map[string]interface{})["op"] = "lt"
				} else {
					newThresholds[0].(map[string]interface{})["op"] = "gt"
					newThresholds[1].(map[string]interface{})["op"] = "gt"
				}
			}
		} else if len(newThresholds) == 1 {
			// Single threshold gets "gt" operation
			newThresholds[0].(map[string]interface{})["op"] = "gt"
		}

		// Update the panel with new thresholds
		panel["thresholds"] = newThresholds

		// Remove old threshold properties from grid
		delete(grid, "threshold1")
		delete(grid, "threshold1Color")
		delete(grid, "threshold2")
		delete(grid, "threshold2Color")
		delete(grid, "thresholdLine")
	}

	return nil
}
