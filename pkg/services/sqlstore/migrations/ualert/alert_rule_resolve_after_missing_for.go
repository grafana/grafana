package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddAlertRuleResolveAfterMissingFor adds resolve_after_missing_for column to alert_rule and alert_rule_version tables.
func AddAlertRuleResolveAfterMissingFor(mg *migrator.Migrator) {
	column := &migrator.Column{Name: "resolve_after_missing_for", Type: migrator.DB_BigInt, Nullable: true}

	mg.AddMigration(
		"add resolve_after_missing_for column to alert_rule",
		migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule"}, column),
	)
	mg.AddMigration(
		"add resolve_after_missing_for column to alert_rule_version",
		migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule_version"}, column),
	)
}
