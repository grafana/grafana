package schemaversion

import "context"

// V15 migration is a no-op migration
// It only updates the schema version to 15
// It's created to keep the migration history consistent with frontend migrator
// No specific migration logic is needed between schema version 14 and 15

// Example before migration:
// {
//   "schemaVersion": 14,
//   "title": "My Dashboard",
//   "panels": [...]
// }

// Example after migration:
// {
//   "schemaVersion": 15,
//   "title": "My Dashboard",
//   "panels": [...]
// }

func V15(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 15
	return nil
}
