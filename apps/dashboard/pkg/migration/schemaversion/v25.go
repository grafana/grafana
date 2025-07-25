package schemaversion

// V25 migration is a no-op migration
// It only updates the schema version to 25
// It's created to keep the migration history consistent with frontend migrator

func V25(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(25)
	return nil
}
