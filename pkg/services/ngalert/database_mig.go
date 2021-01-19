package ngalert

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addAlertDefinitionMigrations(mg *migrator.Migrator) {
	mg.AddMigration("delete alert_definition table", migrator.NewDropTableMigration("alert_definition"))

	alertDefinition := migrator.Table{
		Name: "alert_definition",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "title", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "condition", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "data", Type: migrator.DB_Text, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "interval_seconds", Type: migrator.DB_BigInt, Nullable: false, Default: fmt.Sprintf("%d", defaultIntervalSeconds)},
			{Name: "version", Type: migrator.DB_Int, Nullable: false, Default: "0"},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false, Default: "0"},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id", "title"}, Type: migrator.IndexType},
			{Cols: []string{"org_id", "uid"}, Type: migrator.IndexType},
		},
	}
	// create table
	mg.AddMigration("recreate alert_definition table", migrator.NewAddTableMigration(alertDefinition))

	// create indices
	mg.AddMigration("add index in alert_definition on org_id and title columns", migrator.NewAddIndexMigration(alertDefinition, alertDefinition.Indices[0]))
	mg.AddMigration("add index in alert_definition on org_id and uid columns", migrator.NewAddIndexMigration(alertDefinition, alertDefinition.Indices[1]))

	mg.AddMigration("alter alert_definition table data column to mediumtext in mysql", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE alert_definition MODIFY data MEDIUMTEXT;"))
}

func addAlertDefinitionVersionMigrations(mg *migrator.Migrator) {
	mg.AddMigration("delete alert_definition_version table", migrator.NewDropTableMigration("alert_definition_version"))

	alertDefinitionVersion := migrator.Table{
		Name: "alert_definition_version",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "alert_definition_id", Type: migrator.DB_BigInt},
			{Name: "alert_definition_uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false, Default: "0"},
			{Name: "parent_version", Type: migrator.DB_Int, Nullable: false},
			{Name: "restored_from", Type: migrator.DB_Int, Nullable: false},
			{Name: "version", Type: migrator.DB_Int, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "title", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "condition", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "data", Type: migrator.DB_Text, Nullable: false},
			{Name: "interval_seconds", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"alert_definition_id", "version"}, Type: migrator.UniqueIndex},
			{Cols: []string{"alert_definition_uid", "version"}, Type: migrator.UniqueIndex},
		},
	}
	mg.AddMigration("recreate alert_definition_version table", migrator.NewAddTableMigration(alertDefinitionVersion))
	mg.AddMigration("add index in alert_definition_version table on alert_definition_id and version columns", migrator.NewAddIndexMigration(alertDefinitionVersion, alertDefinitionVersion.Indices[0]))
	mg.AddMigration("add index in alert_definition_version table on alert_definition_uid and version columns", migrator.NewAddIndexMigration(alertDefinitionVersion, alertDefinitionVersion.Indices[1]))

	mg.AddMigration("alter alert_definition_version table data column to mediumtext in mysql", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE alert_definition_version MODIFY data MEDIUMTEXT;"))
}

func alertInstanceMigration(mg *migrator.Migrator) {
	alertInstance := migrator.Table{
		Name: "alert_instance",
		Columns: []*migrator.Column{
			{Name: "def_org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "def_uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false, Default: "0"},
			{Name: "labels", Type: migrator.DB_Text, Nullable: false},
			{Name: "labels_hash", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "current_state", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "current_state_since", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "last_eval_time", Type: migrator.DB_BigInt, Nullable: false},
		},
		PrimaryKeys: []string{"def_org_id", "def_uid", "labels_hash"},
		Indices: []*migrator.Index{
			{Cols: []string{"def_org_id", "def_uid", "current_state"}, Type: migrator.IndexType},
			{Cols: []string{"def_org_id", "current_state"}, Type: migrator.IndexType},
		},
	}

	// create table
	mg.AddMigration("create alert_instance table", migrator.NewAddTableMigration(alertInstance))
	mg.AddMigration("add index in alert_instance table on def_org_id, def_uid and current_state columns", migrator.NewAddIndexMigration(alertInstance, alertInstance.Indices[0]))
	mg.AddMigration("add index in alert_instance table on def_org_id, current_state columns", migrator.NewAddIndexMigration(alertInstance, alertInstance.Indices[1]))
}
