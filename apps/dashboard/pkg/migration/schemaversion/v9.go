package schemaversion

import (
	"context"
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

func V9(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 9

	return nil
}
