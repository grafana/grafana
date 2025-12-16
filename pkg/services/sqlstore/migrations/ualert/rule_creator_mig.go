package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddRuleNotificationSettingsColumns creates a column for notification settings in the alert_rule and alert_rule_version tables.
func AddAlertRuleUpdatedByMigration(mg *migrator.Migrator) {
	mg.AddMigration("add created_by column to alert_rule_version table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule_version"}, &migrator.Column{
		Name:     "created_by",
		Type:     migrator.DB_Varchar,
		Length:   40,
		Nullable: true,
	}))

	mg.AddMigration("add updated_by column to alert_rule table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule"}, &migrator.Column{
		Name:     "updated_by",
		Type:     migrator.DB_Varchar,
		Length:   40,
		Nullable: true,
	}))
}

func ExpandAlertRuleUpdatedByMigration(mg *migrator.Migrator) {
	mg.AddMigration("expand created_by in alert_rule_version table", migrator.NewRawSQLMigration("").
		SQLite("SELECT 1;"). // do nothing for sqlite because it's a TEXT column
		Postgres("ALTER TABLE `alert_rule_version` ALTER COLUMN created_by TYPE VARCHAR(190);").
		Mysql("ALTER TABLE `alert_rule_version` MODIFY created_by VARCHAR(190);"))

	mg.AddMigration("expand updated_by in alert_rule table", migrator.NewRawSQLMigration("").
		SQLite("SELECT 1;"). // do nothing for sqlite because it's a TEXT column
		Postgres("ALTER TABLE `alert_rule` ALTER COLUMN updated_by TYPE VARCHAR(190);").
		Mysql("ALTER TABLE `alert_rule` MODIFY updated_by VARCHAR(190);"))
}
