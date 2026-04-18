package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddStateEvaluationDurationColumn adds an evaluation_duration_ns column to alert_instance.
func AddStateEvaluationDurationColumn(mg *migrator.Migrator) {
	mg.AddMigration("add evaluation_duration_ns column to alert_instance table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_instance"}, &migrator.Column{
		Name:     "evaluation_duration_ns",
		Type:     migrator.DB_BigInt,
		Nullable: true,
	}))
}
