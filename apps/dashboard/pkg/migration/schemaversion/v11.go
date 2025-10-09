package schemaversion

import "context"

// V11 migration is a no-op migration
// It only updates the schema version to 11
// It's created to keep the migration history consistent
// Frontend migrator doesn't have a migration for schema version 11
// No specific migration logic is needed between schema version 10 and 11

// Example before migration:
// {
//   "schemaVersion": 10,
//   "title": "My Dashboard",
//   "panels": [...]
// }

// Example after migration:
// {
//   "schemaVersion": 11,
//   "title": "My Dashboard",
//   "panels": [...]
// }

func V11(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 11
	return nil
}
