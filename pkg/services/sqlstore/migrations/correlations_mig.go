package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addCorrelationsMigrations(mg *Migrator) {
	correlationsV1 := Table{
		Name: "correlation",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "source_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			// Nullable because in the future we want to have correlations to external resources
			{Name: "target_uid", Type: DB_NVarchar, Length: 40, Nullable: true},
			{Name: "label", Type: DB_Text, Nullable: false},
			{Name: "description", Type: DB_Text, Nullable: false},
		},
	}

	mg.AddMigration("create correlation table v1", NewAddTableMigration(correlationsV1))
}
