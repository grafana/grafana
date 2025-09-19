package schemaversion

import (
	"strings"
)

// V9 migration removes the first threshold value from singlestat panel thresholds when they have 3 or more values.
// This migration aligns with the frontend schema version 9 changes that addressed aliasYAxis changes
// specifically for singlestat panels with threshold configurations.
//
// Background:
// In earlier versions, singlestat panels stored threshold values as comma-separated strings with the first element
// representing a baseline value that was not actually used in threshold calculations. This migration removes that
// unused first element to clean up the data structure.
//
// Example before migration:
// {
//   "schemaVersion": 8,
//   "panels": [
//     {
//       "type": "singlestat",
//       "thresholds": "10,20,30"
//     }
//   ]
// }
//
// Example after migration:
// {
//   "schemaVersion": 9,
//   "panels": [
//     {
//       "type": "singlestat",
//       "thresholds": "20,30"
//     }
//   ]
// }

func V9(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 9

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, p := range panels {
		panel, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		// Only process singlestat panels
		panelType := GetStringValue(panel, "type")
		if panelType != "singlestat" {
			continue
		}

		// Get thresholds as string
		thresholds, ok := panel["thresholds"].(string)
		if !ok || thresholds == "" {
			continue
		}

		// Split the comma-separated thresholds
		thresholdParts := strings.Split(thresholds, ",")

		// Only modify thresholds if they have 3 or more values
		if len(thresholdParts) >= 3 {
			// Remove the first threshold value (equivalent to JavaScript's shift())
			newThresholdParts := thresholdParts[1:]
			// Join them back into a comma-separated string
			panel["thresholds"] = strings.Join(newThresholdParts, ",")
		}
	}

	return nil
}
