package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// The "migrated" flag means you can use mode 3 or 4
func addUnifiedStatusMigrations(mg *migrator.Migrator) {
	resourceStorageStatus := migrator.Table{
		Name: "resource_storage_status",
		Columns: []*migrator.Column{
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: false},
			{Name: "migrated", Type: migrator.DB_BigInt, Nullable: false},   // Timestamp when we can start trusting unified storage
			{Name: "migrating", Type: migrator.DB_BigInt, Nullable: false},  // Activly running a migration (start timestamp)
			{Name: "update_key", Type: migrator.DB_BigInt, Nullable: false}, // optimistic lock key -- required for update
		},
		Indices: []*migrator.Index{
			{Cols: []string{"group", "resource", "namespace"}, Type: migrator.UniqueIndex},
		},
	}
	mg.AddMigration("create resource_storage_status table", migrator.NewAddTableMigration(resourceStorageStatus))
}
