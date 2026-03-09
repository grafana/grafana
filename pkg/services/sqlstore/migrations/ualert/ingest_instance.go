package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddIngestInstanceMigrations adds the ingest_instance table for the
// pluggable alert ingestion feature. Each row represents a configured
// webhook endpoint mapped to an alerting plugin and org.
func AddIngestInstanceMigrations(mg *migrator.Migrator) {
	ingestInstanceTable := migrator.Table{
		Name: "ingest_instance",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "token", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false, Default: "''"},
			{Name: "plugin_id", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "settings", Type: migrator.DB_Text, Nullable: false},
			{Name: "created_at", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated_at", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"token"}, Type: migrator.UniqueIndex},
			{Cols: []string{"org_id"}},
		},
	}

	mg.AddMigration("create ingest_instance table", migrator.NewAddTableMigration(ingestInstanceTable))
	mg.AddMigration("add unique index on ingest_instance.token", migrator.NewAddIndexMigration(ingestInstanceTable, ingestInstanceTable.Indices[0]))
	mg.AddMigration("add index on ingest_instance.org_id", migrator.NewAddIndexMigration(ingestInstanceTable, ingestInstanceTable.Indices[1]))
}
