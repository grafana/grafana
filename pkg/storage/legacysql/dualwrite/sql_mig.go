package dualwrite

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// Not yet used... but you get the idea
func AddUnifiedStatusMigrations(mg *migrator.Migrator) {
	resourceStorageStatus := migrator.Table{
		Name: "resource_storage_status",
		Columns: []*migrator.Column{
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "write_legacy", Type: migrator.DB_Bool, Nullable: false, Default: "TRUE"},
			{Name: "write_unified", Type: migrator.DB_Bool, Nullable: false, Default: "TRUE"},
			{Name: "read_unified", Type: migrator.DB_Bool, Nullable: false},
			{Name: "migrating", Type: migrator.DB_BigInt, Nullable: false}, // Timestamp Actively running a migration (start timestamp)
			{Name: "migrated", Type: migrator.DB_BigInt, Nullable: false},  // Timestamp job finished
			{Name: "runtime", Type: migrator.DB_Bool, Nullable: false, Default: "TRUE"},
			{Name: "update_key", Type: migrator.DB_BigInt, Nullable: false}, // optimistic lock key -- required for update
		},
		Indices: []*migrator.Index{
			{Cols: []string{"group", "resource"}, Type: migrator.UniqueIndex},
		},
	}
	mg.AddMigration("create resource_storage_status table", migrator.NewAddTableMigration(resourceStorageStatus))
}
