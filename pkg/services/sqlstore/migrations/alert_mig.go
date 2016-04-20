package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addAlertMigrations(mg *Migrator) {
	mg.AddMigration("Drop old table alert table", NewDropTableMigration("alert"))

	alertV1 := Table{
		Name: "alert",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
			{Name: "panel_id", Type: DB_BigInt, Nullable: false},
			{Name: "query", Type: DB_Text, Nullable: false},
			{Name: "query_ref_id", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "warn_level", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "crit_level", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "interval", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "description", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "query_range", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "aggregator", Type: DB_NVarchar, Length: 255, Nullable: false},
		},
	}

	// create table
	mg.AddMigration("create alert table v1", NewAddTableMigration(alertV1))
}
