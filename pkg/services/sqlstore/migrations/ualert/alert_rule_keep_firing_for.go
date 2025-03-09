package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddAlertRuleKeepFiringFor adds keep_firing_for column to alert_rule and alert_rule_version tables.
func AddAlertRuleKeepFiringFor(mg *migrator.Migrator) {
	column := &migrator.Column{Name: "keep_firing_for", Type: migrator.DB_BigInt, Nullable: false, Default: "0"}

	mg.AddMigration(
		"add keep_firing_for column to alert_rule",
		migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule"}, column),
	)
	mg.AddMigration(
		"add keep_firing_for column to alert_rule_version",
		migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule_version"}, column),
	)
}
