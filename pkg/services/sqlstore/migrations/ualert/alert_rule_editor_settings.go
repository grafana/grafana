package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddRuleMetadata adds column to store alerting rule metadata, such as editor settings for the UI.
func AddRuleMetadata(mg *migrator.Migrator) {
	column := &migrator.Column{
		Name:     "metadata",
		Type:     migrator.DB_Text,
		Nullable: true,
	}

	mg.AddMigration(
		"add metadata column to alert_rule table",
		migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule"}, column),
	)
	mg.AddMigration(
		"add metadata column to alert_rule_version table",
		migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule_version"}, column),
	)
}
