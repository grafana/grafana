package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func changePhlareIdToGrafanaPyroscope(mg *migrator.Migrator) {
	mg.AddMigration("update datasource type",
		migrator.NewRawSQLMigration("").
			SQLite(`UPDATE data_source SET type='grafana-pyroscope' WHERE type='phlare';`).
			Postgres(`UPDATE data_source SET type='grafana-pyroscope' WHERE type='phlare';`).
			Mysql(`UPDATE data_source SET type='grafana-pyroscope' WHERE type='phlare';`),
	)
}
