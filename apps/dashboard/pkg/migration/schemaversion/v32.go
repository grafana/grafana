package schemaversion

// V32 is a no-op migration that serves as a placeholder for consistency.
//
// The migration performs no modifications to the dashboard structure and simply
// updates the schema version number.
// Example (no changes made):
//
// Before migration:
//
//	dashboard: {
//	  "title": "My Dashboard",
//	  "schemaVersion": 31,
//	  "panels": [...]
//	}
//
// After migration:
//
//	dashboard: {
//	  "title": "My Dashboard",
//	  "schemaVersion": 32,
//	  "panels": [...] // unchanged
//	}
func V32(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(32)
	return nil
}
