package schemaversion

import "context"

// V40 normalizes the dashboard refresh property to ensure consistent string typing.
//
// This migration addresses type inconsistencies in dashboard refresh configuration that could
// cause runtime errors or unexpected behavior. Over time, the refresh property has accumulated
// various data types (boolean, numeric, null, undefined) due to different dashboard creation
// methods, API usage patterns, and legacy imports.
//
// The migration works by:
// 1. Checking if the refresh property exists and is already a string type
// 2. Converting any non-string values (boolean true/false, numbers, null) to an empty string
// 3. Ensuring all dashboards have a consistent string-typed refresh property
//
// This normalization is critical because:
// - The frontend refresh logic expects string values for parsing time intervals
// - Non-string values can cause dashboard loading failures
// - Empty string is the standard representation for "no auto-refresh"
// - Consistent typing enables proper validation and UI behavior
//
// Example transformations:
//
// Before migration:
//
//	refresh: true          // boolean
//	refresh: 30           // number (seconds)
//	refresh: null         // null value
//	refresh: undefined    // missing property
//
// After migration:
//
//	refresh: ""           // normalized to empty string
//	refresh: ""           // normalized to empty string
//	refresh: ""           // normalized to empty string
//	refresh: ""           // property added with empty string
func V40(_ context.Context, dash map[string]interface{}) error {
	dash["schemaVersion"] = int(40)
	if _, ok := dash["refresh"].(string); !ok {
		dash["refresh"] = ""
	}
	return nil
}
