package schemaversion

import "context"

// V41 removes the deprecated time_options property from dashboard timepicker configuration.
//
// This migration addresses technical debt by cleaning up legacy timepicker settings that have
// been obsolete since Grafana version 5. The time_options property was originally designed to
// allow customization of predefined time range options in the time picker dropdown, but this
// functionality was superseded by more flexible time selection mechanisms.
//
// The migration works by:
// 1. Locating dashboard timepicker configuration objects
// 2. Removing the deprecated time_options property if present
// 3. Preserving all other timepicker settings (refresh_intervals, etc.)
//
// This cleanup prevents potential confusion for developers and ensures the dashboard schema
// remains focused on actively used configuration options. The removal is safe because the
// time_options property has had no functional impact for several major Grafana versions.
//
// Example transformation:
//
// Before migration:
//
//	timepicker: {
//	  refresh_intervals: ["5s", "10s", "30s", "1m"],
//	  time_options: ["5m", "15m", "1h", "6h", "12h", "24h"]
//	}
//
// After migration:
//
//	timepicker: {
//	  refresh_intervals: ["5s", "10s", "30s", "1m"]
//	}
func V41(_ context.Context, dash map[string]interface{}) error {
	dash["schemaVersion"] = int(41)
	if timepicker, ok := dash["timepicker"].(map[string]interface{}); ok {
		// time_options is a legacy property that was not used since grafana version 5
		// therefore deprecating this property from the schema
		delete(timepicker, "time_options")
	}
	return nil
}
