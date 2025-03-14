package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddAlertRuleMissingSeriesEvalsToResolve adds missing_series_evals_to_resolve column to alert_rule and alert_rule_version tables.
func AddAlertRuleMissingSeriesEvalsToResolve(mg *migrator.Migrator) {
	column := &migrator.Column{Name: "missing_series_evals_to_resolve", Type: migrator.DB_SmallInt, Nullable: true}

	mg.AddMigration(
		"add missing_series_evals_to_resolve column to alert_rule",
		migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule"}, column),
	)
	mg.AddMigration(
		"add missing_series_evals_to_resolve column to alert_rule_version",
		migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule_version"}, column),
	)
}
