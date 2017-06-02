package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addAlertMigrations(mg *Migrator) {

	alertV1 := Table{
		Name: "alert",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "version", Type: DB_BigInt, Nullable: false},
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
			{Name: "panel_id", Type: DB_BigInt, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "message", Type: DB_Text, Nullable: false},
			{Name: "state", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "settings", Type: DB_Text, Nullable: false},
			{Name: "frequency", Type: DB_BigInt, Nullable: false},
			{Name: "handler", Type: DB_BigInt, Nullable: false},
			{Name: "severity", Type: DB_Text, Nullable: false},
			{Name: "silenced", Type: DB_Bool, Nullable: false},
			{Name: "execution_error", Type: DB_Text, Nullable: false},
			{Name: "eval_data", Type: DB_Text, Nullable: true},
			{Name: "eval_date", Type: DB_DateTime, Nullable: true},
			{Name: "new_state_date", Type: DB_DateTime, Nullable: false},
			{Name: "state_changes", Type: DB_Int, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "id"}, Type: IndexType},
			{Cols: []string{"state"}, Type: IndexType},
			{Cols: []string{"dashboard_id"}, Type: IndexType},
		},
	}

	// create table
	mg.AddMigration("create alert table v1", NewAddTableMigration(alertV1))

	// create indices
	mg.AddMigration("add index alert org_id & id ", NewAddIndexMigration(alertV1, alertV1.Indices[0]))
	mg.AddMigration("add index alert state", NewAddIndexMigration(alertV1, alertV1.Indices[1]))
	mg.AddMigration("add index alert dashboard_id", NewAddIndexMigration(alertV1, alertV1.Indices[2]))

	alert_notification := Table{
		Name: "alert_notification",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "type", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "settings", Type: DB_Text, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "name"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create alert_notification table v1", NewAddTableMigration(alert_notification))
	mg.AddMigration("Add column is_default", NewAddColumnMigration(alert_notification, &Column{
		Name: "is_default", Type: DB_Bool, Nullable: false, Default: "0",
	}))
	mg.AddMigration("add index alert_notification org_id & name", NewAddIndexMigration(alert_notification, alert_notification.Indices[0]))

	mg.AddMigration("Update alert table charset", NewTableCharsetMigration("alert", []*Column{
		{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
		{Name: "message", Type: DB_Text, Nullable: false},
		{Name: "state", Type: DB_NVarchar, Length: 190, Nullable: false},
		{Name: "settings", Type: DB_Text, Nullable: false},
		{Name: "severity", Type: DB_Text, Nullable: false},
		{Name: "execution_error", Type: DB_Text, Nullable: false},
		{Name: "eval_data", Type: DB_Text, Nullable: true},
	}))

	mg.AddMigration("Update alert_notification table charset", NewTableCharsetMigration("alert_notification", []*Column{
		{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
		{Name: "type", Type: DB_NVarchar, Length: 255, Nullable: false},
		{Name: "settings", Type: DB_Text, Nullable: false},
	}))
}
