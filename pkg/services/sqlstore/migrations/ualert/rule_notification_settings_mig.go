package ualert

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// AddRuleNotificationSettingsColumns creates a column for notification settings in the alert_rule and alert_rule_version tables.
func AddRuleNotificationSettingsColumns(mg *migrator.Migrator) {
	mg.AddMigration("add notification_settings column to alert_rule table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule"}, &migrator.Column{
		Name:     "notification_settings",
		Type:     migrator.DB_Text,
		Nullable: true,
	}))

	mg.AddMigration("add notification_settings column to alert_rule_version table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule_version"}, &migrator.Column{
		Name:     "notification_settings",
		Type:     migrator.DB_Text,
		Nullable: true,
	}))
}
