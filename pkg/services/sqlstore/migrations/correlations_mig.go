package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addCorrelationsMigrations(mg *Migrator) {
	correlationsV1 := Table{
		Name: "correlation",
		Columns: []*Column{
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false, IsPrimaryKey: true},
			{Name: "source_uid", Type: DB_NVarchar, Length: 40, Nullable: false, IsPrimaryKey: true},
			// Nullable because in the future we want to have correlations to external resources
			{Name: "target_uid", Type: DB_NVarchar, Length: 40, Nullable: true},
			{Name: "label", Type: DB_Text, Nullable: false},
			{Name: "description", Type: DB_Text, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"uid"}},
			{Cols: []string{"source_uid"}},
		},
	}

	mg.AddMigration("create correlation table v1", NewAddTableMigration(correlationsV1))

	mg.AddMigration("add index correlations.uid", NewAddIndexMigration(correlationsV1, correlationsV1.Indices[0]))
	mg.AddMigration("add index correlations.source_uid", NewAddIndexMigration(correlationsV1, correlationsV1.Indices[1]))

	mg.AddMigration("add correlation config column", NewAddColumnMigration(correlationsV1, &Column{
		Name: "config", Type: DB_Text, Nullable: true,
	}))

	// v2: adding org_id column and recreating indices
	correlationsV2 := Table{
		Name: "correlation",
		Columns: []*Column{
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false, IsPrimaryKey: true},
			// All existing records will have '0' assigned
			{Name: "org_id", Type: DB_BigInt, IsPrimaryKey: true, Default: "0"},
			{Name: "source_uid", Type: DB_NVarchar, Length: 40, Nullable: false, IsPrimaryKey: true},
			{Name: "target_uid", Type: DB_NVarchar, Length: 40, Nullable: true},
			{Name: "label", Type: DB_Text, Nullable: false},
			{Name: "description", Type: DB_Text, Nullable: false},
			{Name: "config", Type: DB_Text, Nullable: true},
		},
		Indices: []*Index{
			{Cols: []string{"uid"}},
			{Cols: []string{"source_uid"}},
			{Cols: []string{"org_id"}},
		},
	}

	addTableReplaceMigrations(mg, correlationsV1, correlationsV2, 2, map[string]string{
		"uid":         "uid",
		"source_uid":  "source_uid",
		"target_uid":  "target_uid",
		"label":       "label",
		"description": "description",
		"config":      "config",
	})

	mg.AddMigration("add provisioning column", NewAddColumnMigration(correlationsV2, &Column{
		Name: "provisioned", Type: DB_Bool, Nullable: false, Default: "0",
	}))

	mg.AddMigration("add type column", NewAddColumnMigration(correlationsV2, &Column{
		Name: "type", Type: DB_NVarchar, Length: 40, Nullable: false, Default: "'query'",
	}))
}
