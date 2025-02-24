package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func AddPeakQRenameMigration(mg *migrator.Migrator) {
	mg.AddMigration("Update values of apiVersion for querylibrary in resource", migrator.NewRawSQLMigration("").
		SQLite("UPDATE resource SET \"value\"=REPLACE(\"value\", 'peakq.grafana.app/v0alpha1', 'querylibrary.grafana.app/v0alpha1') WHERE \"group\"='peakq.grafana.app';").
		Postgres("UPDATE resource SET \"value\"=REPLACE(\"value\", 'peakq.grafana.app/v0alpha1', 'querylibrary.grafana.app/v0alpha1') WHERE \"group\"='peakq.grafana.app';").
		Mysql("UPDATE resource SET \"value\"=REPLACE(\"value\", 'peakq.grafana.app/v0alpha1', 'querylibrary.grafana.app/v0alpha1') WHERE \"group\"='peakq.grafana.app';"))

	mg.AddMigration("Update group values for querylibrary in resource", migrator.NewRawSQLMigration("").
		SQLite("UPDATE resource SET \"group\"='querylibrary.grafana.app' WHERE \"group\"='peakq.grafana.app';").
		Postgres("UPDATE resource SET \"group\"='querylibrary.grafana.app' WHERE \"group\"='peakq.grafana.app';").
		Mysql("UPDATE resource SET \"group\"='querylibrary.grafana.app' WHERE \"group\"='peakq.grafana.app';"))

	mg.AddMigration("Update group values for querylibrary in resource history", migrator.NewRawSQLMigration("").
		SQLite("UPDATE resource_history SET \"group\"='querylibrary.grafana.app' WHERE \"group\"='peakq.grafana.app';").
		Postgres("UPDATE resource_history SET \"group\"='querylibrary.grafana.app' WHERE \"group\"='peakq.grafana.app';").
		Mysql("UPDATE resource_history SET \"group\"='querylibrary.grafana.app' WHERE \"group\"='peakq.grafana.app';"))

	mg.AddMigration("Update values of apiVersion for querylibrary in resource_history", migrator.NewRawSQLMigration("").
		SQLite("UPDATE resource_history SET \"value\"=REPLACE(\"value\", 'peakq.grafana.app/v0alpha1', 'querylibrary.grafana.app/v0alpha1') WHERE \"group\"='peakq.grafana.app';").
		Postgres("UPDATE resource_history SET \"value\"=REPLACE(\"value\", 'peakq.grafana.app/v0alpha1', 'querylibrary.grafana.app/v0alpha1') WHERE \"group\"='peakq.grafana.app';").
		Mysql("UPDATE resource_history SET \"value\"=REPLACE(\"value\", 'peakq.grafana.app/v0alpha1', 'querylibrary.grafana.app/v0alpha1') WHERE \"group\"='peakq.grafana.app';"))

	mg.AddMigration("Delete peakq from resource_version", migrator.NewRawSQLMigration("").
		SQLite("DELETE FROM resource_version WHERE \"group\"='peakq.grafana.app';").
		Postgres("DELETE FROM resource_version WHERE \"group\"='peakq.grafana.app';").
		Mysql("DELETE FROM resource_version WHERE \"group\"='peakq.grafana.app';"))
}
