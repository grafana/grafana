package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addAnnotationMig(mg *Migrator) {
	table := Table{
		Name: "annotation",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "alert_id", Type: DB_BigInt, Nullable: true},
			{Name: "user_id", Type: DB_BigInt, Nullable: true},
			{Name: "type", Type: DB_NVarchar, Length: 25, Nullable: false},
			{Name: "title", Type: DB_Text, Nullable: false},
			{Name: "text", Type: DB_Text, Nullable: false},
			{Name: "metric", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "prev_state", Type: DB_NVarchar, Length: 25, Nullable: false},
			{Name: "new_state", Type: DB_NVarchar, Length: 25, Nullable: false},
			{Name: "data", Type: DB_Text, Nullable: false},
			{Name: "timestamp", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "alert_id"}, Type: IndexType},
			{Cols: []string{"org_id", "type"}, Type: IndexType},
			{Cols: []string{"timestamp"}, Type: IndexType},
		},
	}

	mg.AddMigration("create annotation table v1", NewAddTableMigration(table))

	// create indices
	mg.AddMigration("add index annotation org_id & alert_id ", NewAddIndexMigration(table, table.Indices[0]))
	mg.AddMigration("add index annotation org_id & type", NewAddIndexMigration(table, table.Indices[1]))
	mg.AddMigration("add index annotation timestamp", NewAddIndexMigration(table, table.Indices[2]))
}
