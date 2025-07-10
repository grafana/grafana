package schemaversion

// V32 is a no-op migration that serves as a placeholder for consistency.
//
// This migration was reserved but ultimately not implemented as the changes
// originally planned for v32 were moved to other schema versions. To maintain
// consistency in the migration sequence and avoid confusion for future developers,
// this no-op migration ensures that the version numbering remains sequential
// from v31 to v33.
//
// The migration performs no modifications to the dashboard structure and simply
// updates the schema version number. This approach:
// - Maintains clear migration history
// - Prevents confusion about missing schema versions
// - Ensures consistent version progression
// - Provides a clear placeholder for any future migration needs
//
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
