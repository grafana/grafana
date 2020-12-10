package ngalert

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addAlertDefinitionMigrations(mg *migrator.Migrator) {
	alertDefinition := migrator.Table{
		Name: "alert_definition",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "condition", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "data", Type: migrator.DB_Text, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}, Type: migrator.IndexType},
		},
	}
	// create table
	mg.AddMigration("create alert_definition table", migrator.NewAddTableMigration(alertDefinition))

	// create indices
	mg.AddMigration("add index alert_definition org_id", migrator.NewAddIndexMigration(alertDefinition, alertDefinition.Indices[0]))

	now := timeNow()
	mg.AddMigration("add column updated", migrator.NewAddColumnMigration(alertDefinition, &migrator.Column{
		Name: "updated", Type: migrator.DB_BigInt, Nullable: false, Default: fmt.Sprintf("%d", now.Unix()),
	}))

	mg.AddMigration("add index alert_definition updated", migrator.NewAddIndexMigration(alertDefinition, &migrator.Index{
		Cols: []string{"updated"}, Type: migrator.IndexType,
	}))

	mg.AddMigration("add column interval", migrator.NewAddColumnMigration(alertDefinition, &migrator.Column{
		Name: "interval", Type: migrator.DB_BigInt, Nullable: false, Default: fmt.Sprintf("%d", defaultIntervalInSeconds),
	}))

	mg.AddMigration("add column version", migrator.NewAddColumnMigration(alertDefinition, &migrator.Column{
		Name: "version", Type: migrator.DB_Int, Nullable: false, Default: "0",
	}))

	mg.AddMigration("alter alert_definition.data to mediumtext", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE alert_definition MODIFY data MEDIUMTEXT;"))

	mg.AddMigration("drop index alert_definition updated", migrator.NewDropIndexMigration(alertDefinition, &migrator.Index{
		Cols: []string{"updated"}, Type: migrator.IndexType,
	}))
}

func addAlertDefinitionVersionMigrations(mg *migrator.Migrator) {
	alertDefinitionVersion := migrator.Table{
		Name: "alert_definition_version",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "alert_definition_id", Type: migrator.DB_BigInt},
			{Name: "parent_version", Type: migrator.DB_Int, Nullable: false},
			{Name: "restored_from", Type: migrator.DB_Int, Nullable: false},
			{Name: "version", Type: migrator.DB_Int, Nullable: false},
			{Name: "created", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "condition", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "data", Type: migrator.DB_Text, Nullable: false},
			{Name: "interval", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"alert_definition_id", "version"}, Type: migrator.UniqueIndex},
		},
	}
	mg.AddMigration("create alert_definition_version table v1", migrator.NewAddTableMigration(alertDefinitionVersion))
	mg.AddMigration("add unique index alert_definition_version.alert_definition_id and versionn", migrator.NewAddIndexMigration(alertDefinitionVersion, alertDefinitionVersion.Indices[0]))

	rawSQL := fmt.Sprintf(`INSERT INTO alert_definition_version
	(
		%s,
		%s,
		%s,
		%s,
		%s,
		%s,
		%s,
		%s,
		%s
	)
	SELECT
		alert_definition.id,
		alert_definition.version,
		alert_definition.version,
		alert_definition.version,
		alert_definition.updated,
		alert_definition.name,
		alert_definition.condition,
		alert_definition.data,
		alert_definition.interval
	FROM alert_definition;`,
		mg.Dialect.Quote("alert_definition_id"),
		mg.Dialect.Quote("version"),
		mg.Dialect.Quote("parent_version"),
		mg.Dialect.Quote("restored_from"),
		mg.Dialect.Quote("created"),
		mg.Dialect.Quote("name"),
		mg.Dialect.Quote("condition"),
		mg.Dialect.Quote("data"),
		mg.Dialect.Quote("interval"),
	)
	mg.AddMigration("save existing alert_definition data in alert_definition_version table", migrator.NewRawSQLMigration(rawSQL))

	const setVersionTo1WhereZeroSQL = `UPDATE alert_definition SET version = 1 WHERE version = 0`
	mg.AddMigration("Set alert_definition version to 1 where 0", migrator.NewRawSQLMigration(setVersionTo1WhereZeroSQL))

	mg.AddMigration("alter alert_definition_version.data to mediumtext", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE alert_definition_version MODIFY data MEDIUMTEXT;"))
}
