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

	alertRuleTagTable := Table{
		Name: "alert_rule_tag",
		Columns: []*Column{
			{Name: "alert_id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true},
			{Name: "tag_id", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"alert_id", "tag_id"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("Create alert_rule_tag table v1", NewAddTableMigration(alertRuleTagTable))
	mg.AddMigration("Add unique index alert_rule_tag.alert_id_tag_id", NewAddIndexMigration(alertRuleTagTable, alertRuleTagTable.Indices[0]))

	// drop alert_rule_tag indexes
	addDropAllIndicesMigrations(mg, "v1", alertRuleTagTable)
	// rename table
	addTableRenameMigration(mg, "alert_rule_tag", "alert_rule_tag_v1", "v1")

	// alert_rule_tag V2
	alertRuleTagTableV2 := Table{
		Name: "alert_rule_tag",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "alert_id", Type: DB_BigInt, Nullable: false},
			{Name: "tag_id", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"alert_id", "tag_id"}, Type: UniqueIndex},
		},
	}
	// recreate table
	mg.AddMigration("Create alert_rule_tag table v2", NewAddTableMigration(alertRuleTagTableV2))
	// recreate indices
	addTableIndicesMigrations(mg, "Add unique index alert_rule_tag.alert_id_tag_id V2", alertRuleTagTableV2)
	// copy data
	mg.AddMigration("copy alert_rule_tag v1 to v2", NewCopyTableDataMigration("alert_rule_tag", "alert_rule_tag_v1", map[string]string{
		"alert_id": "alert_id",
		"tag_id":   "tag_id",
	}))

	mg.AddMigration("drop table alert_rule_tag_v1", NewDropTableMigration("alert_rule_tag_v1"))

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
	mg.AddMigration("Add column frequency", NewAddColumnMigration(alert_notification, &Column{
		Name: "frequency", Type: DB_BigInt, Nullable: true,
	}))
	mg.AddMigration("Add column send_reminder", NewAddColumnMigration(alert_notification, &Column{
		Name: "send_reminder", Type: DB_Bool, Nullable: true, Default: "0",
	}))
	mg.AddMigration("Add column disable_resolve_message", NewAddColumnMigration(alert_notification, &Column{
		Name: "disable_resolve_message", Type: DB_Bool, Nullable: false, Default: "0",
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

	notification_journal := Table{
		Name: "alert_notification_journal",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "alert_id", Type: DB_BigInt, Nullable: false},
			{Name: "notifier_id", Type: DB_BigInt, Nullable: false},
			{Name: "sent_at", Type: DB_BigInt, Nullable: false},
			{Name: "success", Type: DB_Bool, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "alert_id", "notifier_id"}, Type: IndexType},
		},
	}

	mg.AddMigration("create notification_journal table v1", NewAddTableMigration(notification_journal))
	mg.AddMigration("add index notification_journal org_id & alert_id & notifier_id", NewAddIndexMigration(notification_journal, notification_journal.Indices[0]))

	mg.AddMigration("drop alert_notification_journal", NewDropTableMigration("alert_notification_journal"))

	alert_notification_state := Table{
		Name: "alert_notification_state",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "alert_id", Type: DB_BigInt, Nullable: false},
			{Name: "notifier_id", Type: DB_BigInt, Nullable: false},
			{Name: "state", Type: DB_NVarchar, Length: 50, Nullable: false},
			{Name: "version", Type: DB_BigInt, Nullable: false},
			{Name: "updated_at", Type: DB_BigInt, Nullable: false},
			{Name: "alert_rule_state_updated_version", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "alert_id", "notifier_id"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create alert_notification_state table v1", NewAddTableMigration(alert_notification_state))
	mg.AddMigration("add index alert_notification_state org_id & alert_id & notifier_id",
		NewAddIndexMigration(alert_notification_state, alert_notification_state.Indices[0]))

	mg.AddMigration("Add for to alert table", NewAddColumnMigration(alertV1, &Column{
		Name: "for", Type: DB_BigInt, Nullable: true,
	}))

	mg.AddMigration("Add column uid in alert_notification", NewAddColumnMigration(alert_notification, &Column{
		Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: true,
	}))

	mg.AddMigration("Update uid column values in alert_notification", new(RawSQLMigration).
		SQLite("UPDATE alert_notification SET uid=printf('%09d',id) WHERE uid IS NULL;").
		Postgres("UPDATE alert_notification SET uid=lpad('' || id::text,9,'0') WHERE uid IS NULL;").
		Mysql("UPDATE alert_notification SET uid=lpad(id,9,'0') WHERE uid IS NULL;"))

	mg.AddMigration("Add unique index alert_notification_org_id_uid", NewAddIndexMigration(alert_notification, &Index{
		Cols: []string{"org_id", "uid"}, Type: UniqueIndex,
	}))

	mg.AddMigration("Remove unique index org_id_name", NewDropIndexMigration(alert_notification, &Index{
		Cols: []string{"org_id", "name"}, Type: UniqueIndex,
	}))

	mg.AddMigration("Add column secure_settings in alert_notification", NewAddColumnMigration(alert_notification, &Column{
		Name: "secure_settings", Type: DB_Text, Nullable: true,
	}))

	// change column type of alert.settings
	mg.AddMigration("alter alert.settings to mediumtext", NewRawSQLMigration("").
		Mysql("ALTER TABLE alert MODIFY settings MEDIUMTEXT;"))

	mg.AddMigration("Add non-unique index alert_notification_state_alert_id", NewAddIndexMigration(alert_notification_state, &Index{
		Cols: []string{"alert_id"}, Type: IndexType,
	}))

	mg.AddMigration("Add non-unique index alert_rule_tag_alert_id", NewAddIndexMigration(alertRuleTagTable, &Index{
		Cols: []string{"alert_id"}, Type: IndexType,
	}))
}
