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

// ExpandAlertRuleMissingSeriesEvalsToResolve widens missing_series_evals_to_resolve to match its int64 model.
func ExpandAlertRuleMissingSeriesEvalsToResolve(mg *migrator.Migrator) {
	mg.AddMigration("alter alert_rule missing_series_evals_to_resolve column to bigint", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE alert_rule MODIFY missing_series_evals_to_resolve BIGINT NULL;").
		Postgres("ALTER TABLE alert_rule ALTER COLUMN missing_series_evals_to_resolve TYPE BIGINT;"))
	mg.AddMigration("alter alert_rule_version missing_series_evals_to_resolve column to bigint", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE alert_rule_version MODIFY missing_series_evals_to_resolve BIGINT NULL;").
		Postgres("ALTER TABLE alert_rule_version ALTER COLUMN missing_series_evals_to_resolve TYPE BIGINT;"))
}
