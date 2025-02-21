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
