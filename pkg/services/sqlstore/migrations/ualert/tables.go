package ualert

import (
	"fmt"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// DefaultFieldMaxLength is the standard size for most user-settable string fields in Alerting. Use this for typical string fields, unless you have a special reason not to.
const DefaultFieldMaxLength = 190

// UIDMaxLength is the standard size for fields that contain UIDs.
const UIDMaxLength = 40

// AddTablesMigrations defines database migrations that affect Grafana Alerting tables.
func AddTablesMigrations(mg *migrator.Migrator) {
	// Migrations are meant to be immutable, any modifications to table structure
	// should come in the form of a new migration appended to the end of AddTablesMigrations
	// instead of modifying an existing one. This ensure that tables are modified in a consistent and correct order.
	historicalTableMigrations(mg)

	mg.AddMigration("add last_applied column to alert_configuration_history", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_configuration_history"}, &migrator.Column{
		Name: "last_applied", Type: migrator.DB_Int, Nullable: false, Default: "0",
	}))
	// End of migration log, add new migrations above this line.
}

// historicalTableMigrations contains those migrations that existed prior to creating the improved messaging around migration immutability.
func historicalTableMigrations(mg *migrator.Migrator) {
	// DO NOT EDIT
	addAlertDefinitionMigrations(mg, 60)
	addAlertDefinitionVersionMigrations(mg)
	// Create alert_instance table
	alertInstanceMigration(mg)

	// Create alert_rule
	addAlertRuleMigrations(mg, 60)
	addAlertRuleVersionMigrations(mg)

	// Create Alertmanager configurations
	addAlertmanagerConfigMigrations(mg)

	// Create Admin Configuration
	addAlertAdminConfigMigrations(mg)

	// Create provisioning data table
	addProvisioningMigrations(mg)

	addAlertImageMigrations(mg)

	addAlertmanagerConfigHistoryMigrations(mg)

	extractAlertmanagerConfigurationHistoryMigration(mg)
}

// addAlertDefinitionMigrations should not be modified.
func addAlertDefinitionMigrations(mg *migrator.Migrator, defaultIntervalSeconds int64) {
	// DO NOT EDIT
	mg.AddMigration("delete alert_definition table", migrator.NewDropTableMigration("alert_definition"))

	alertDefinition := migrator.Table{
		Name: "alert_definition",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "title", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "condition", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "data", Type: migrator.DB_Text, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "interval_seconds", Type: migrator.DB_BigInt, Nullable: false, Default: fmt.Sprintf("%d", defaultIntervalSeconds)},
			{Name: "version", Type: migrator.DB_Int, Nullable: false, Default: "0"},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: UIDMaxLength, Nullable: false, Default: "0"},
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

	mg.AddMigration("drop index in alert_definition on org_id and title columns", migrator.NewDropIndexMigration(alertDefinition, alertDefinition.Indices[0]))
	mg.AddMigration("drop index in alert_definition on org_id and uid columns", migrator.NewDropIndexMigration(alertDefinition, alertDefinition.Indices[1]))

	uniqueIndices := []*migrator.Index{
		{Cols: []string{"org_id", "title"}, Type: migrator.UniqueIndex},
		{Cols: []string{"org_id", "uid"}, Type: migrator.UniqueIndex},
	}
	mg.AddMigration("add unique index in alert_definition on org_id and title columns", migrator.NewAddIndexMigration(alertDefinition, uniqueIndices[0]))
	mg.AddMigration("add unique index in alert_definition on org_id and uid columns", migrator.NewAddIndexMigration(alertDefinition, uniqueIndices[1]))

	mg.AddMigration("Add column paused in alert_definition", migrator.NewAddColumnMigration(alertDefinition, &migrator.Column{
		Name: "paused", Type: migrator.DB_Bool, Nullable: false, Default: "0",
	}))

	mg.AddMigration("drop alert_definition table", migrator.NewDropTableMigration("alert_definition"))
}

// addAlertDefinitionMigrations should not be modified.
func addAlertDefinitionVersionMigrations(mg *migrator.Migrator) {
	// DO NOT EDIT
	mg.AddMigration("delete alert_definition_version table", migrator.NewDropTableMigration("alert_definition_version"))

	alertDefinitionVersion := migrator.Table{
		Name: "alert_definition_version",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "alert_definition_id", Type: migrator.DB_BigInt},
			{Name: "alert_definition_uid", Type: migrator.DB_NVarchar, Length: UIDMaxLength, Nullable: false, Default: "0"},
			{Name: "parent_version", Type: migrator.DB_Int, Nullable: false},
			{Name: "restored_from", Type: migrator.DB_Int, Nullable: false},
			{Name: "version", Type: migrator.DB_Int, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "title", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "condition", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
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
	mg.AddMigration("drop alert_definition_version table", migrator.NewDropTableMigration("alert_definition_version"))
}

func alertInstanceMigration(mg *migrator.Migrator) {
	// DO NOT EDIT
	alertInstance := migrator.Table{
		Name: "alert_instance",
		Columns: []*migrator.Column{
			{Name: "def_org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "def_uid", Type: migrator.DB_NVarchar, Length: UIDMaxLength, Nullable: false, Default: "0"},
			{Name: "labels", Type: migrator.DB_Text, Nullable: false},
			{Name: "labels_hash", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "current_state", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
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
	mg.AddMigration("add column current_state_end to alert_instance", migrator.NewAddColumnMigration(alertInstance, &migrator.Column{
		Name: "current_state_end", Type: migrator.DB_BigInt, Nullable: false, Default: "0",
	}))

	mg.AddMigration("remove index def_org_id, def_uid, current_state on alert_instance", migrator.NewDropIndexMigration(alertInstance, alertInstance.Indices[0]))
	mg.AddMigration("remove index def_org_id, current_state on alert_instance", migrator.NewDropIndexMigration(alertInstance, alertInstance.Indices[1]))

	mg.AddMigration("rename def_org_id to rule_org_id in alert_instance", migrator.NewRawSQLMigration("").
		Default("ALTER TABLE alert_instance RENAME COLUMN def_org_id TO rule_org_id;").
		Mysql("ALTER TABLE alert_instance CHANGE def_org_id rule_org_id BIGINT;"))

	mg.AddMigration("rename def_uid to rule_uid in alert_instance", migrator.NewRawSQLMigration("").
		Default("ALTER TABLE alert_instance RENAME COLUMN def_uid TO rule_uid;").
		Mysql("ALTER TABLE alert_instance CHANGE def_uid rule_uid VARCHAR(40);"))

	mg.AddMigration("add index rule_org_id, rule_uid, current_state on alert_instance", migrator.NewAddIndexMigration(alertInstance, &migrator.Index{
		Cols: []string{"rule_org_id", "rule_uid", "current_state"}, Type: migrator.IndexType,
	}))
	mg.AddMigration("add index rule_org_id, current_state on alert_instance", migrator.NewAddIndexMigration(alertInstance, &migrator.Index{
		Cols: []string{"rule_org_id", "current_state"}, Type: migrator.IndexType,
	}))

	mg.AddMigration("add current_reason column related to current_state",
		migrator.NewAddColumnMigration(alertInstance, &migrator.Column{
			Name: "current_reason", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: true,
		}))

	mg.AddMigration("add result_fingerprint column to alert_instance", migrator.NewAddColumnMigration(alertInstance, &migrator.Column{
		Name: "result_fingerprint", Type: migrator.DB_NVarchar, Length: 16, Nullable: true,
	}))
}

var titleUniqueIndex = &migrator.Index{Cols: []string{"org_id", "namespace_uid", "title"}, Type: migrator.UniqueIndex}

func addAlertRuleMigrations(mg *migrator.Migrator, defaultIntervalSeconds int64) {
	// DO NOT EDIT
	alertRule := migrator.Table{
		Name: "alert_rule",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "title", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "condition", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "data", Type: migrator.DB_Text, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "interval_seconds", Type: migrator.DB_BigInt, Nullable: false, Default: fmt.Sprintf("%d", defaultIntervalSeconds)},
			{Name: "version", Type: migrator.DB_Int, Nullable: false, Default: "0"},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: UIDMaxLength, Nullable: false, Default: "0"},
			// the following fields will correspond to a dashboard (or folder) UIID
			{Name: "namespace_uid", Type: migrator.DB_NVarchar, Length: UIDMaxLength, Nullable: false},
			{Name: "rule_group", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "no_data_state", Type: migrator.DB_NVarchar, Length: 15, Nullable: false, Default: "'NoData'"},
			{Name: "exec_err_state", Type: migrator.DB_NVarchar, Length: 15, Nullable: false, Default: "'Alerting'"},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id", "title"}, Type: migrator.UniqueIndex},
			{Cols: []string{"org_id", "uid"}, Type: migrator.UniqueIndex},
			{Cols: []string{"org_id", "namespace_uid", "rule_group"}, Type: migrator.IndexType},
		},
	}
	// create table
	mg.AddMigration("create alert_rule table", migrator.NewAddTableMigration(alertRule))

	// create indices
	mg.AddMigration("add index in alert_rule on org_id and title columns", migrator.NewAddIndexMigration(alertRule, alertRule.Indices[0]))
	mg.AddMigration("add index in alert_rule on org_id and uid columns", migrator.NewAddIndexMigration(alertRule, alertRule.Indices[1]))
	mg.AddMigration("add index in alert_rule on org_id, namespace_uid, group_uid columns", migrator.NewAddIndexMigration(alertRule, alertRule.Indices[2]))

	mg.AddMigration("alter alert_rule table data column to mediumtext in mysql", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE alert_rule MODIFY data MEDIUMTEXT;"))

	// add for column
	mg.AddMigration("add column for to alert_rule", migrator.NewAddColumnMigration(alertRule, &migrator.Column{Name: "for", Type: migrator.DB_BigInt, Nullable: false, Default: "0"}))

	// add annotations column
	mg.AddMigration("add column annotations to alert_rule", migrator.NewAddColumnMigration(alertRule, &migrator.Column{Name: "annotations", Type: migrator.DB_Text, Nullable: true}))

	// add labels column
	mg.AddMigration("add column labels to alert_rule", migrator.NewAddColumnMigration(alertRule, &migrator.Column{Name: "labels", Type: migrator.DB_Text, Nullable: true}))

	mg.AddMigration("remove unique index from alert_rule on org_id, title columns", migrator.NewDropIndexMigration(alertRule, &migrator.Index{
		Cols: []string{"org_id", "title"}, Type: migrator.UniqueIndex,
	}))

	mg.AddMigration("add index in alert_rule on org_id, namespase_uid and title columns", migrator.NewAddIndexMigration(alertRule, titleUniqueIndex))

	mg.AddMigration("add dashboard_uid column to alert_rule", migrator.NewAddColumnMigration(
		migrator.Table{Name: "alert_rule"},
		&migrator.Column{
			Name:     "dashboard_uid",
			Type:     migrator.DB_NVarchar,
			Length:   40,
			Nullable: true,
		},
	))

	mg.AddMigration("add panel_id column to alert_rule", migrator.NewAddColumnMigration(
		migrator.Table{Name: "alert_rule"},
		&migrator.Column{
			Name:     "panel_id",
			Type:     migrator.DB_BigInt,
			Nullable: true,
		},
	))

	mg.AddMigration("add index in alert_rule on org_id, dashboard_uid and panel_id columns", migrator.NewAddIndexMigration(
		migrator.Table{Name: "alert_rule"},
		&migrator.Index{
			Name: "IDX_alert_rule_org_id_dashboard_uid_panel_id",
			Cols: []string{"org_id", "dashboard_uid", "panel_id"},
		},
	))

	mg.AddMigration("add rule_group_idx column to alert_rule", migrator.NewAddColumnMigration(
		migrator.Table{Name: "alert_rule"},
		&migrator.Column{
			Name:     "rule_group_idx",
			Type:     migrator.DB_Int,
			Nullable: false,
			Default:  "1",
		},
	))

	mg.AddMigration("add is_paused column to alert_rule table", migrator.NewAddColumnMigration(
		alertRule,
		&migrator.Column{
			Name:     "is_paused",
			Type:     migrator.DB_Bool,
			Nullable: false,
			Default:  "0",
		},
	))

	// This migration fixes a bug where "false" for the default value created a column with default "true" in PostgreSQL databases
	mg.AddMigration("fix is_paused column for alert_rule table", migrator.NewRawSQLMigration("").
		Postgres(`ALTER TABLE alert_rule ALTER COLUMN is_paused SET DEFAULT false;
UPDATE alert_rule SET is_paused = false;`))
}

var alertRuleVersionUDX_OrgIdRuleUIDVersion = &migrator.Index{Cols: []string{"rule_org_id", "rule_uid", "version"}, Type: migrator.UniqueIndex}

func addAlertRuleVersionMigrations(mg *migrator.Migrator) {
	// DO NOT EDIT
	alertRuleVersion := migrator.Table{
		Name: "alert_rule_version",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "rule_org_id", Type: migrator.DB_BigInt},
			{Name: "rule_uid", Type: migrator.DB_NVarchar, Length: UIDMaxLength, Nullable: false, Default: "0"},
			// the following fields will correspond to a dashboard (or folder) UID
			{Name: "rule_namespace_uid", Type: migrator.DB_NVarchar, Length: UIDMaxLength, Nullable: false},
			{Name: "rule_group", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "parent_version", Type: migrator.DB_Int, Nullable: false},
			{Name: "restored_from", Type: migrator.DB_Int, Nullable: false},
			{Name: "version", Type: migrator.DB_Int, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "title", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "condition", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "data", Type: migrator.DB_Text, Nullable: false},
			{Name: "interval_seconds", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "no_data_state", Type: migrator.DB_NVarchar, Length: 15, Nullable: false, Default: "'NoData'"},
			{Name: "exec_err_state", Type: migrator.DB_NVarchar, Length: 15, Nullable: false, Default: "'Alerting'"},
		},
		Indices: []*migrator.Index{
			alertRuleVersionUDX_OrgIdRuleUIDVersion,
			{Cols: []string{"rule_org_id", "rule_namespace_uid", "rule_group"}, Type: migrator.IndexType},
		},
	}
	mg.AddMigration("create alert_rule_version table", migrator.NewAddTableMigration(alertRuleVersion))
	mg.AddMigration("add index in alert_rule_version table on rule_org_id, rule_uid and version columns", migrator.NewAddIndexMigration(alertRuleVersion, alertRuleVersionUDX_OrgIdRuleUIDVersion))
	mg.AddMigration("add index in alert_rule_version table on rule_org_id, rule_namespace_uid and rule_group columns", migrator.NewAddIndexMigration(alertRuleVersion, alertRuleVersion.Indices[1]))

	mg.AddMigration("alter alert_rule_version table data column to mediumtext in mysql", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE alert_rule_version MODIFY data MEDIUMTEXT;"))

	// add for column
	mg.AddMigration("add column for to alert_rule_version", migrator.NewAddColumnMigration(alertRuleVersion, &migrator.Column{Name: "for", Type: migrator.DB_BigInt, Nullable: false, Default: "0"}))

	// add annotations column
	mg.AddMigration("add column annotations to alert_rule_version", migrator.NewAddColumnMigration(alertRuleVersion, &migrator.Column{Name: "annotations", Type: migrator.DB_Text, Nullable: true}))

	// add labels column
	mg.AddMigration("add column labels to alert_rule_version", migrator.NewAddColumnMigration(alertRuleVersion, &migrator.Column{Name: "labels", Type: migrator.DB_Text, Nullable: true}))

	mg.AddMigration("add rule_group_idx column to alert_rule_version", migrator.NewAddColumnMigration(
		migrator.Table{Name: "alert_rule_version"},
		&migrator.Column{
			Name:     "rule_group_idx",
			Type:     migrator.DB_Int,
			Nullable: false,
			Default:  "1",
		},
	))

	mg.AddMigration("add is_paused column to alert_rule_versions table", migrator.NewAddColumnMigration(
		alertRuleVersion,
		&migrator.Column{
			Name:     "is_paused",
			Type:     migrator.DB_Bool,
			Nullable: false,
			Default:  "0",
		},
	))

	// This migration fixes a bug where "false" for the default value created a column with default "true" in PostgreSQL databases
	mg.AddMigration("fix is_paused column for alert_rule_version table", migrator.NewRawSQLMigration("").
		Postgres(`ALTER TABLE alert_rule_version ALTER COLUMN is_paused SET DEFAULT false;
UPDATE alert_rule_version SET is_paused = false;`))
}

func addAlertmanagerConfigMigrations(mg *migrator.Migrator) {
	// DO NOT EDIT
	alertConfiguration := migrator.Table{
		Name: "alert_configuration",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "alertmanager_configuration", Type: migrator.DB_Text, Nullable: false},
			{Name: "configuration_version", Type: migrator.DB_NVarchar, Length: 3}, // In a format of vXX e.g. v1, v2, v10, etc
			{Name: "created_at", Type: migrator.DB_Int, Nullable: false},
		},
	}

	mg.AddMigration("create_alert_configuration_table", migrator.NewAddTableMigration(alertConfiguration))
	mg.AddMigration("Add column default in alert_configuration", migrator.NewAddColumnMigration(alertConfiguration, &migrator.Column{
		Name: "default", Type: migrator.DB_Bool, Nullable: false, Default: "0",
	}))

	mg.AddMigration("alert alert_configuration alertmanager_configuration column from TEXT to MEDIUMTEXT if mysql", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE alert_configuration MODIFY alertmanager_configuration MEDIUMTEXT;"))

	mg.AddMigration("add column org_id in alert_configuration", migrator.NewAddColumnMigration(alertConfiguration, &migrator.Column{
		Name: "org_id", Type: migrator.DB_BigInt, Nullable: false, Default: "0",
	}))

	// add index on org_id
	mg.AddMigration("add index in alert_configuration table on org_id column", migrator.NewAddIndexMigration(alertConfiguration, &migrator.Index{
		Cols: []string{"org_id"},
	}))

	mg.AddMigration("add configuration_hash column to alert_configuration", migrator.NewAddColumnMigration(alertConfiguration, &migrator.Column{
		Name: "configuration_hash", Type: migrator.DB_Varchar, Nullable: false, Default: "'not-yet-calculated'", Length: 32,
	}))
}

func addAlertmanagerConfigHistoryMigrations(mg *migrator.Migrator) {
	// DO NOT EDIT
	alertConfigHistory := migrator.Table{
		Name: "alert_configuration_history",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false, Default: "0"},
			{Name: "alertmanager_configuration", Type: migrator.DB_MediumText, Nullable: false},
			{Name: "configuration_hash", Type: migrator.DB_Varchar, Nullable: false, Default: "'not-yet-calculated'", Length: 32},
			{Name: "configuration_version", Type: migrator.DB_NVarchar, Length: 3}, // In a format of vXX e.g. v1, v2, v10, etc
			{Name: "created_at", Type: migrator.DB_Int, Nullable: false},
			{Name: "default", Type: migrator.DB_Bool, Nullable: false, Default: "0"},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}},
		},
	}

	mg.AddMigration("create_alert_configuration_history_table", migrator.NewAddTableMigration(alertConfigHistory))
}

func addAlertAdminConfigMigrations(mg *migrator.Migrator) {
	// DO NOT EDIT
	adminConfiguration := migrator.Table{
		Name: "ngalert_configuration",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "alertmanagers", Type: migrator.DB_Text, Nullable: true},

			{Name: "created_at", Type: migrator.DB_Int, Nullable: false},
			{Name: "updated_at", Type: migrator.DB_Int, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create_ngalert_configuration_table", migrator.NewAddTableMigration(adminConfiguration))
	mg.AddMigration("add index in ngalert_configuration on org_id column", migrator.NewAddIndexMigration(adminConfiguration, adminConfiguration.Indices[0]))
	mg.AddMigration("add column send_alerts_to in ngalert_configuration", migrator.NewAddColumnMigration(adminConfiguration, &migrator.Column{
		Name: "send_alerts_to", Type: migrator.DB_SmallInt, Nullable: false, Default: "0",
	}))
}

func addProvisioningMigrations(mg *migrator.Migrator) {
	// DO NOT EDIT
	provisioningTable := migrator.Table{
		Name: "provenance_type",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "record_key", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "record_type", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "provenance", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"record_type", "record_key", "org_id"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create provenance_type table", migrator.NewAddTableMigration(provisioningTable))
	mg.AddMigration("add index to uniquify (record_key, record_type, org_id) columns", migrator.NewAddIndexMigration(provisioningTable, provisioningTable.Indices[0]))
}

func addAlertImageMigrations(mg *migrator.Migrator) {
	// DO NOT EDIT
	imageTable := migrator.Table{
		Name: "alert_image",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "token", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "path", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "url", Type: migrator.DB_NVarchar, Length: DefaultFieldMaxLength, Nullable: false},
			{Name: "created_at", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "expires_at", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"token"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create alert_image table", migrator.NewAddTableMigration(imageTable))
	mg.AddMigration("add unique index on token to alert_image table", migrator.NewAddIndexMigration(imageTable, imageTable.Indices[0]))

	mg.AddMigration("support longer URLs in alert_image table", migrator.NewRawSQLMigration("").
		Postgres("ALTER TABLE alert_image ALTER COLUMN url TYPE VARCHAR(2048);").
		Mysql("ALTER TABLE alert_image MODIFY url VARCHAR(2048) NOT NULL;"))
}

func extractAlertmanagerConfigurationHistoryMigration(mg *migrator.Migrator) {
	// Since it's not always consistent as to what state the org ID indexes are in, just drop them all and rebuild from scratch.
	// This is not expensive since this table is guaranteed to have a small number of rows.
	mg.AddMigration("drop non-unique orgID index on alert_configuration", migrator.NewDropIndexMigration(migrator.Table{Name: "alert_configuration"}, &migrator.Index{Cols: []string{"org_id"}}))
	mg.AddMigration("drop unique orgID index on alert_configuration if exists", migrator.NewDropIndexMigration(migrator.Table{Name: "alert_configuration"}, &migrator.Index{Type: migrator.UniqueIndex, Cols: []string{"org_id"}}))
	mg.AddMigration("extract alertmanager configuration history to separate table", &extractAlertmanagerConfigurationHistory{})
	mg.AddMigration("add unique index on orgID to alert_configuration", migrator.NewAddIndexMigration(migrator.Table{Name: "alert_configuration"}, &migrator.Index{Type: migrator.UniqueIndex, Cols: []string{"org_id"}}))
}

type extractAlertmanagerConfigurationHistory struct {
	migrator.MigrationBase
}

// extractAMConfigHistoryConfigModel is the model of an alertmanager configuration row, at the time that the extractAlertmanagerConfigurationHistory migration was run.
// This is not to be used outside of the extractAlertmanagerConfigurationHistory migration.
type extractAMConfigHistoryConfigModel struct {
	ID                        int64 `xorm:"pk autoincr 'id'"`
	AlertmanagerConfiguration string
	ConfigurationHash         string
	ConfigurationVersion      string
	CreatedAt                 int64 `xorm:"created"`
	Default                   bool
	OrgID                     int64 `xorm:"org_id"`
}

func (c extractAlertmanagerConfigurationHistory) SQL(migrator.Dialect) string {
	return codeMigration
}

func (c extractAlertmanagerConfigurationHistory) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	// DO NOT EDIT
	var orgs []int64
	if err := sess.Table("alert_configuration").Distinct("org_id").Find(&orgs); err != nil {
		return fmt.Errorf("failed to retrieve the organizations with alerting configurations: %w", err)
	}

	// Clear out the history table, just in case. It should already be empty.
	if _, err := sess.Exec("DELETE FROM alert_configuration_history"); err != nil {
		return fmt.Errorf("failed to clear the config history table: %w", err)
	}

	for _, orgID := range orgs {
		var activeConfigID int64
		has, err := sess.SQL(`SELECT MAX(id) FROM alert_configuration WHERE org_id = ?`, orgID).Get(&activeConfigID)
		if err != nil {
			return fmt.Errorf("failed to query active config ID for org %d: %w", orgID, err)
		}
		if !has {
			return fmt.Errorf("we previously found a config for org, but later it was unexpectedly missing: %d", orgID)
		}

		history := make([]extractAMConfigHistoryConfigModel, 0)
		err = sess.Table("alert_configuration").Where("org_id = ? AND id < ?", orgID, activeConfigID).Find(&history)
		if err != nil {
			return fmt.Errorf("failed to query for non-active configs for org %d: %w", orgID, err)
		}

		// Set the IDs back to the default, so XORM will ignore the field and auto-assign them.
		for i := range history {
			history[i].ID = 0
		}

		_, err = sess.Table("alert_configuration_history").InsertMulti(history)
		if err != nil {
			return fmt.Errorf("failed to insert historical configs for org: %d: %w", orgID, err)
		}

		_, err = sess.Exec("DELETE FROM alert_configuration WHERE org_id = ? AND id < ?", orgID, activeConfigID)
		if err != nil {
			return fmt.Errorf("failed to evict old configurations for org after moving to history table: %d: %w", orgID, err)
		}
	}
	return nil
}

func DropTitleUniqueIndexMigration(mg *migrator.Migrator) {
	mg.AddMigration("remove title in folder unique index",
		migrator.NewDropIndexMigration(migrator.Table{Name: "alert_rule"}, titleUniqueIndex))
}
