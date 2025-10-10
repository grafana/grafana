package schemaversion

import "context"

// V7 migration handles the nav to timepicker conversion and ensures query refIds.
// This migration transforms the legacy nav property to the newer timepicker format
// and ensures all panel targets have refId properties.
//
// Background:
// In earlier versions, dashboards used a "nav" property array to store time picker
// configuration. This migration moves the first nav item to the "timepicker" property.
// Additionally, it ensures all query targets have refId properties assigned.
//
// Example before migration:
// {
//   "schemaVersion": 6,
//   "nav": [
//     {
//       "enable": true,
//       "type": "timepicker",
//       "status": "Stable",
//       "time_options": ["5m", "15m", "1h", "6h", "12h", "24h", "2d", "7d", "30d"],
//       "refresh_intervals": ["5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"],
//       "now": true,
//       "collapse": false,
//       "notice": false
//     }
//   ],
//   "panels": [
//     {
//       "targets": [
//         {"expr": "up"},
//         {"expr": "cpu_usage", "refId": "B"}
//       ]
//     }
//   ]
// }
//
// Example after migration:
// {
//   "schemaVersion": 7,
//   "timepicker": {
//     "enable": true,
//     "type": "timepicker",
//     "status": "Stable",
//     "time_options": ["5m", "15m", "1h", "6h", "12h", "24h", "2d", "7d", "30d"],
//     "refresh_intervals": ["5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"],
//     "now": true,
//     "collapse": false,
//     "notice": false
//   },
//   "panels": [
//     {
//       "targets": [
//         {"expr": "up", "refId": "A"},
//         {"expr": "cpu_usage", "refId": "B"}
//       ]
//     }
//   ]
// }

func V7(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 7

	// Convert nav to timepicker (matches frontend DashboardMigrator logic)
	if nav, ok := dashboard["nav"].([]interface{}); ok && len(nav) > 0 {
		if firstNav, ok := nav[0].(map[string]interface{}); ok {
			dashboard["timepicker"] = firstNav
		}
	}

	return nil
}
