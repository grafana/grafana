package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddDatasourceSyncTable adds the ngalert_datasource_sync table used for automatic
// Mimir Alertmanager datasource configuration sync.
func AddDatasourceSyncTable(mg *migrator.Migrator) {
	table := migrator.Table{
		Name: "ngalert_datasource_sync",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "datasource_uid", Type: migrator.DB_NVarchar, Length: UIDMaxLength, Nullable: false},
			{Name: "enabled", Type: migrator.DB_Bool, Nullable: false, Default: "0"},
			{Name: "last_sync_at", Type: migrator.DB_DateTime, Nullable: true},
			{Name: "last_error", Type: migrator.DB_Text, Nullable: true},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("add ngalert_datasource_sync table", migrator.NewAddTableMigration(table))
	mg.AddMigration(
		"add unique index to ngalert_datasource_sync on org_id",
		migrator.NewAddIndexMigration(table, table.Indices[0]),
	)
}
