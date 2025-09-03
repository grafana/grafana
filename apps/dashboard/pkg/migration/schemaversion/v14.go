package schemaversion

import "context"

// V14 migrates the sharedCrosshair boolean property to graphTooltip integer property.
// This migration converts the old boolean shared crosshair setting to the new integer-based
// graph tooltip setting for consistency with updated dashboard tooltip behavior.

// Example before migration:
// {
//   "schemaVersion": 13,
//   "title": "My Dashboard",
//   "sharedCrosshair": true,
//   "panels": [...]
// }

// Example after migration:
// {
//   "schemaVersion": 14,
//   "title": "My Dashboard",
//   "graphTooltip": 1,
//   "panels": [...]
// }

func V14(_ context.Context, dashboard map[string]interface{}) error {
	// Convert sharedCrosshair boolean to graphTooltip integer
	sharedCrosshair := GetBoolValue(dashboard, "sharedCrosshair")

	if sharedCrosshair {
		dashboard["graphTooltip"] = 1
	} else {
		dashboard["graphTooltip"] = 0
	}

	// Remove the old sharedCrosshair property
	delete(dashboard, "sharedCrosshair")

	dashboard["schemaVersion"] = 14
	return nil
}
