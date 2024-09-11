package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddRuleEditorSettings adds column to store alerting rule editor settings for the UI.
func AddRuleEditorSettings(mg *migrator.Migrator) {
	column := &migrator.Column{
		Name:     "editor_settings",
		Type:     migrator.DB_Text,
		Nullable: true,
	}

	mg.AddMigration(
		"add editor_settings column to alert_rule table",
		migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule"}, column),
	)
	mg.AddMigration(
		"add editor_settings column to alert_rule_version table",
		migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule_version"}, column),
	)
}
