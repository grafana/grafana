package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addReportsMigrations(mg *Migrator) {

	reportsV1 := Table{
		Name: "reports",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
			{Name: "name", Type: DB_Text, Nullable: false},
			{Name: "recipients", Type: DB_Text, Nullable: false},
			{Name: "reply_to", Type: DB_Text, Nullable: false},
			{Name: "message", Type: DB_Text, Nullable: true},
			{Name: "cron", Type: DB_Char, Length: 32},
			{Name: "send_to", Type: DB_Text, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "id"}, Type: IndexType},
			{Cols: []string{"dashboard_id"}, Type: IndexType},
		},
	}

	// create table
	mg.AddMigration("create reports table v1", NewAddTableMigration(reportsV1))

	// create indices
	mg.AddMigration("add index reports dashboard_id", NewAddIndexMigration(reportsV1, reportsV1.Indices[0]))
}
