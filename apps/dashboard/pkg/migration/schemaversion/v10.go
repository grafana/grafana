package schemaversion

import "context"

// V10 migration removes the first threshold value from table panel styles when they have 3 or more thresholds.
// This migration aligns with the frontend schema version 10 changes that addressed aliasYAxis changes
// specifically for table panels with threshold configurations.
//
// Background:
// In earlier versions, table panels stored threshold values as arrays with the first element representing
// a baseline value that was not actually used in threshold calculations. This migration removes that
// unused first element to clean up the data structure.
//
// Example before migration:
// {
//   "schemaVersion": 9,
//   "panels": [
//     {
//       "type": "table",
//       "styles": [
//         {
//           "thresholds": ["10", "20", "30"]
//         },
//         {
//           "thresholds": ["100", "200", "300"]
//         }
//       ]
//     }
//   ]
// }
//
// Example after migration:
// {
//   "schemaVersion": 10,
//   "panels": [
//     {
//       "type": "table",
//       "styles": [
//         {
//           "thresholds": ["20", "30"]
//         },
//         {
//           "thresholds": ["200", "300"]
//         }
//       ]
//     }
//   ]
// }

func V10(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 10

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, p := range panels {
		panel, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		// Only process table panels
		panelType := GetStringValue(panel, "type")
		if panelType != "table" {
			continue
		}

		styles, ok := panel["styles"].([]interface{})
		if !ok {
			continue
		}

		// Process each style in the table panel
		for _, s := range styles {
			style, ok := s.(map[string]interface{})
			if !ok {
				continue
			}

			thresholds, ok := style["thresholds"].([]interface{})
			if !ok {
				continue
			}

			// Only modify thresholds if they have 3 or more values
			if len(thresholds) >= 3 {
				// Remove the first threshold value
				newThresholds := thresholds[1:]
				style["thresholds"] = newThresholds
			}
		}
	}

	return nil
}
