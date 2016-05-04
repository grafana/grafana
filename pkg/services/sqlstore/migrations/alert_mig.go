package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addAlertMigrations(mg *Migrator) {
	alertV1 := Table{
		Name: "alert_rule",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
			{Name: "panel_id", Type: DB_BigInt, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "query", Type: DB_Text, Nullable: false},
			{Name: "query_ref_id", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "warn_level", Type: DB_BigInt, Nullable: false},
			{Name: "warn_operator", Type: DB_NVarchar, Length: 10, Nullable: false},
			{Name: "crit_level", Type: DB_BigInt, Nullable: false},
			{Name: "crit_operator", Type: DB_NVarchar, Length: 10, Nullable: false},
			{Name: "interval", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "description", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "query_range", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "aggregator", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "state", Type: DB_NVarchar, Length: 255, Nullable: false},
		},
	}

	// create table
	mg.AddMigration("create alert_rule table v1", NewAddTableMigration(alertV1))

	alert_changes := Table{
		Name: "alert_rule_change",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "alert_id", Type: DB_BigInt, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "type", Type: DB_NVarchar, Length: 50, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
		},
	}

	mg.AddMigration("create alert_rules_updates table v1", NewAddTableMigration(alert_changes))

	alert_state_log := Table{
		Name: "alert_state",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "alert_id", Type: DB_BigInt, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "new_state", Type: DB_NVarchar, Length: 50, Nullable: false},
			{Name: "info", Type: DB_Text, Nullable: true},
			{Name: "created", Type: DB_DateTime, Nullable: false},
		},
	}

	mg.AddMigration("create alert_state_log table v1", NewAddTableMigration(alert_state_log))
}
