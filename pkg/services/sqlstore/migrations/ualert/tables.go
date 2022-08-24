package ualert

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// AddMigration defines database migrations.
func AddTablesMigrations(mg *migrator.Migrator) {
	AddAlertDefinitionMigrations(mg, 60)
	AddAlertDefinitionVersionMigrations(mg)
	// Create alert_instance table
	AlertInstanceMigration(mg)

	// Create alert_rule
	AddAlertRuleMigrations(mg, 60)
	AddAlertRuleVersionMigrations(mg)

	// Create Alertmanager configurations
	AddAlertmanagerConfigMigrations(mg)

	// Create Admin Configuration
	AddAlertAdminConfigMigrations(mg)

	// Create provisioning data table
	AddProvisioningMigrations(mg)

	AddAlertImageMigrations(mg)
}

// AddAlertDefinitionMigrations should not be modified.
func AddAlertDefinitionMigrations(mg *migrator.Migrator, defaultIntervalSeconds int64) {
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

// AddAlertDefinitionMigrations should not be modified.
func AddAlertDefinitionVersionMigrations(mg *migrator.Migrator) {
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
	mg.AddMigration("drop alert_definition_version table", migrator.NewDropTableMigration("alert_definition_version"))
}

func AlertInstanceMigration(mg *migrator.Migrator) {
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
			Name: "current_reason", Type: migrator.DB_NVarchar, Length: 190, Nullable: true,
		}))
}

func AddAlertRuleMigrations(mg *migrator.Migrator, defaultIntervalSeconds int64) {
	alertRule := migrator.Table{
		Name: "alert_rule",
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
			// the following fields will correspond to a dashboard (or folder) UIID
			{Name: "namespace_uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "rule_group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
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

	mg.AddMigration("add index in alert_rule on org_id, namespase_uid and title columns", migrator.NewAddIndexMigration(alertRule, &migrator.Index{
		Cols: []string{"org_id", "namespace_uid", "title"}, Type: migrator.UniqueIndex,
	}))

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
}

func AddAlertRuleVersionMigrations(mg *migrator.Migrator) {
	alertRuleVersion := migrator.Table{
		Name: "alert_rule_version",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "rule_org_id", Type: migrator.DB_BigInt},
			{Name: "rule_uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false, Default: "0"},
			// the following fields will correspond to a dashboard (or folder) UID
			{Name: "rule_namespace_uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "rule_group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "parent_version", Type: migrator.DB_Int, Nullable: false},
			{Name: "restored_from", Type: migrator.DB_Int, Nullable: false},
			{Name: "version", Type: migrator.DB_Int, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "title", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "condition", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "data", Type: migrator.DB_Text, Nullable: false},
			{Name: "interval_seconds", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "no_data_state", Type: migrator.DB_NVarchar, Length: 15, Nullable: false, Default: "'NoData'"},
			{Name: "exec_err_state", Type: migrator.DB_NVarchar, Length: 15, Nullable: false, Default: "'Alerting'"},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"rule_org_id", "rule_uid", "version"}, Type: migrator.UniqueIndex},
			{Cols: []string{"rule_org_id", "rule_namespace_uid", "rule_group"}, Type: migrator.IndexType},
		},
	}
	mg.AddMigration("create alert_rule_version table", migrator.NewAddTableMigration(alertRuleVersion))
	mg.AddMigration("add index in alert_rule_version table on rule_org_id, rule_uid and version columns", migrator.NewAddIndexMigration(alertRuleVersion, alertRuleVersion.Indices[0]))
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
}

func AddAlertmanagerConfigMigrations(mg *migrator.Migrator) {
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

func AddAlertAdminConfigMigrations(mg *migrator.Migrator) {
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

func AddProvisioningMigrations(mg *migrator.Migrator) {
	provisioningTable := migrator.Table{
		Name: "provenance_type",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "record_key", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "record_type", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "provenance", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"record_type", "record_key", "org_id"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create provenance_type table", migrator.NewAddTableMigration(provisioningTable))
	mg.AddMigration("add index to uniquify (record_key, record_type, org_id) columns", migrator.NewAddIndexMigration(provisioningTable, provisioningTable.Indices[0]))
}

func AddAlertImageMigrations(mg *migrator.Migrator) {
	imageTable := migrator.Table{
		Name: "alert_image",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "token", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "path", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "url", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
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
