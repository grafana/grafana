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
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: true},
			{Name: "panel_id", Type: DB_BigInt, Nullable: true},
			{Name: "category_id", Type: DB_BigInt, Nullable: true},
			{Name: "type", Type: DB_NVarchar, Length: 25, Nullable: false},
			{Name: "title", Type: DB_Text, Nullable: false},
			{Name: "text", Type: DB_Text, Nullable: false},
			{Name: "metric", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "prev_state", Type: DB_NVarchar, Length: 25, Nullable: false},
			{Name: "new_state", Type: DB_NVarchar, Length: 25, Nullable: false},
			{Name: "data", Type: DB_Text, Nullable: false},
			{Name: "epoch", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "alert_id"}, Type: IndexType},
			{Cols: []string{"org_id", "type"}, Type: IndexType},
			{Cols: []string{"org_id", "category_id"}, Type: IndexType},
			{Cols: []string{"org_id", "dashboard_id", "panel_id", "epoch"}, Type: IndexType},
			{Cols: []string{"org_id", "epoch"}, Type: IndexType},
		},
	}

	mg.AddMigration("Drop old annotation table v4", NewDropTableMigration("annotation"))

	mg.AddMigration("create annotation table v5", NewAddTableMigration(table))

	// create indices
	mg.AddMigration("add index annotation 0 v3", NewAddIndexMigration(table, table.Indices[0]))
	mg.AddMigration("add index annotation 1 v3", NewAddIndexMigration(table, table.Indices[1]))
	mg.AddMigration("add index annotation 2 v3", NewAddIndexMigration(table, table.Indices[2]))
	mg.AddMigration("add index annotation 3 v3", NewAddIndexMigration(table, table.Indices[3]))
	mg.AddMigration("add index annotation 4 v3", NewAddIndexMigration(table, table.Indices[4]))

	mg.AddMigration("Update annotation table charset", NewTableCharsetMigration("annotation", []*Column{
		{Name: "type", Type: DB_NVarchar, Length: 25, Nullable: false},
		{Name: "title", Type: DB_Text, Nullable: false},
		{Name: "text", Type: DB_Text, Nullable: false},
		{Name: "metric", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "prev_state", Type: DB_NVarchar, Length: 25, Nullable: false},
		{Name: "new_state", Type: DB_NVarchar, Length: 25, Nullable: false},
		{Name: "data", Type: DB_Text, Nullable: false},
	}))
}
