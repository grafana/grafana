/*
 * Copyright (C) 2021-2025 BMC Helix Inc
 * Added by ymulthan at 12/20/2021
 */

package migrations

import (
	"fmt"
	"strings"
	"time"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// cleanString sanitizes input parameters for use in SQL queries by escaping single quotes.
// It accepts variadic parameters of any type and returns a slice with cleaned values.
// For string values, it replaces single quotes (') with two single quotes (”) to prevent SQL injection.
// Non-string values are passed through unchanged.
// This function is primarily used to sanitize string literals before embedding them in raw SQL statements.
func cleanString(params ...any) []any {
	cleanedValues := make([]any, 0)
	replacer := strings.NewReplacer("'", "''")

	for _, val := range params {
		if strVal, ok := val.(string); ok {
			cleanedVal := replacer.Replace(strVal)
			cleanedValues = append(cleanedValues, cleanedVal)
		} else {
			cleanedValues = append(cleanedValues, val)
		}
	}
	return cleanedValues
}

// We are creating metadata view list table in grafana postgres db
// Also adding ootb entries for view which are supposed to be available for all tenants (with tenant 1)

func addMetaDataView(mg *Migrator) {
	metaDataTableV1 := Table{
		Name: "rms_metadata_view_list",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "name", Type: DB_Text, Nullable: false},
			{Name: "tenant_id", Type: DB_BigInt, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "file_key", Type: DB_Text, Nullable: false},
			{Name: "itsm_comp_version", Type: DB_Text, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"name", "tenant_id"}, Type: UniqueIndex},
		},
	}

	// Create new view list table if not created already through grafana migration utility
	mg.AddMigration("create metadata view list table v1", NewAddTableMigration(metaDataTableV1))

	// Add column base_view_id to the table
	mg.AddMigration("Add column base_view_id to the table", NewAddColumnMigration(metaDataTableV1, &Column{
		Name: "base_view_id", Type: DB_BigInt, Nullable: true,
	}))

	created := time.Now()
	formattedTs := fmt.Sprintf("%d-%02d-%02dT%02d:%02d:%02d",
		created.Year(), created.Month(), created.Day(),
		created.Hour(), created.Minute(), created.Second())
	mg.AddMigration("ITSM view : Incident Management V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Incident Management', 1, 1, 'Incident_Management','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Change Management view : Change Management V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Change Management', 1, 1, 'Change_Management','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Problem Management view : Problem Management V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Problem Management', 1, 1, 'Problem_Management','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Work Order Management view : Work Order Management V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Work Order Management', 1, 1, 'Work_Order_Management','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Service Request Management view : Service Request Management V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Service Request Management', 1, 1, 'Service_Request_Management','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Task Management view : Task Management V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Task Management', 1, 1, 'Task_Management','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Service Level Management view : Service Level Management V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Service Level Management', 1, 1, 'Service_Level_Management','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Asset Management view : Asset Management V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Asset Management', 1, 1, 'Asset_Management','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Configuration Management view : Configuration Management V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Configuration Management', 1, 1, 'Configuration_Management','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Incident Management Archive : Incident Management Archive V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Incident Management Archive', 1, 1, 'Incident_Management_Archive','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Change Management Archive : Change Management Archive V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Change Management Archive', 1, 1, 'Change_Management_Archive','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Work Order Management Archive : Work Order Management Archive V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Work Order Management Archive', 1, 1, 'Work_Order_Management_Archive','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Task Management Archive : Task Management Archive V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Task Management Archive', 1, 1, 'Task_Management_Archive','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Release Management view : Release Management V1",
		NewRawSQLMigration(fmt.Sprintf(`
	  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
	  VALUES('Release Management', 1, 1, 'Release_Management','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Problem Management Archive view : Problem Management Archive V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Problem Management Archive', 1, 1, 'Problem_Management_Archive','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Configuration Management GenAI Ready view : Configuration Management GenAI Ready V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Configuration Management GenAI Ready', 1, 1, 'Configuration_Management_GenAI_Ready','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("ITSM Knowledge Management Archive View : ITSM Knowledge Management Archive V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('ITSM Knowledge Management Archive', 1, 1, 'ITSM_Knowledge_Management_Archive','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	// Adding fail safe for below two insertions of BWF case and knowledge views
	mg.AddMigration("Remove BWF Case view if present already", NewRawSQLMigration(
		"DELETE FROM rms_metadata_view_list WHERE name = 'BWF Case Management' AND tenant_id = 1",
	))

	mg.AddMigration("Remove BWF Knowledge view if present already", NewRawSQLMigration(
		"DELETE FROM rms_metadata_view_list WHERE name = 'BWF Knowledge Management' AND tenant_id = 1",
	))

	mg.AddMigration("BWF Case view : BWF Case Management V1 24.1.00",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('BWF Case Management', 1, 1, 'BWF_Case_Management','22_1_04', '%s', '%s')
		  ON CONFLICT DO NOTHING`, formattedTs, formattedTs)),
	)

	mg.AddMigration("BWF Knowledge view : BWF Knowledge Management V1 24.1.00",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('BWF Knowledge Management', 1, 1, 'BWF_Knowledge_Management','22_1_04', '%s', '%s')
		  ON CONFLICT DO NOTHING`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Digital Workplace view : Digital Workplace V1 24.1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Digital Workplace', 1, 1, 'Digital_Workplace','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Sample Metadata View : Sample Metadata V1 24.1.01",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Sample Metadata View', 1, 1, 'Sample_Metadata_View','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("ITSM Knowledge Management View : ITSM Knowledge Management V1 24.2.02",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('ITSM Knowledge Management View', 1, 1, 'ITSM_Knowledge_Management','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("ITSM Knowledge Management View : Name change",
		NewRawSQLMigration(`
		 UPDATE rms_metadata_view_list SET name='ITSM Knowledge Management' where tenant_id=1 and name='ITSM Knowledge Management View'`),
	)

	mg.AddMigration("ITSM Knowledge Management View : Delete entry",
		NewRawSQLMigration(
			"DELETE FROM rms_metadata_view_list where name='ITSM Knowledge Management' and tenant_id=1"),
	)

	mg.AddMigration("ITSM Knowledge Management View : ITSM Knowledge Management V1 24.1.01",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('ITSM Knowledge Management', 1, 1, 'ITSM_Knowledge_Management','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	mg.AddMigration("Service Management Foundation View : Service Management Foundation V1",
		NewRawSQLMigration(fmt.Sprintf(`
		  INSERT INTO rms_metadata_view_list (name, tenant_id, user_id, file_key, itsm_comp_version, created, updated)
		  VALUES('Service Management Foundation', 1, 1, 'Service_Management_Foundation','22_1_04', '%s', '%s')`, formattedTs, formattedTs)),
	)

	// Adding new column "deleted" for 23.4.02 to implement soft delete functionality
	mg.AddMigration("Alter rms_metadata_view_list, Add column deleted", NewAddColumnMigration(metaDataTableV1, &Column{
		Name: "deleted", Type: DB_Bool, Nullable: true, Default: "0",
	}))

	rawSQL := `CREATE UNIQUE INDEX if not exists
		UQE_rms_metadata_view_list_name_tenant_id
			ON
		rms_metadata_view_list (name, tenant_id)`
	mg.AddMigration("add index on rms_metadata_view_list name and tenant_id if not present already v1",
		NewRawSQLMigration(rawSQL))

	mg.AddMigration("drop existing index UQE_rms_metadata_view_list_name_tenant_id ", NewRawSQLMigration(`
		DROP INDEX if exists UQE_rms_metadata_view_list_name_tenant_id
	`))

	mg.AddMigration("add index on rms_metadata_view_list name and tenant_id if not present already v2",
		NewRawSQLMigration(`
			CREATE UNIQUE INDEX if not exists
			UQE_rms_metadata_view_list_name_tenant_id
				ON
			rms_metadata_view_list (name, tenant_id, deleted)
		`))

	mg.AddMigration("Delete BWF view if present",
		NewRawSQLMigration(`DELETE FROM rms_metadata_view_list where name = 'BWF' and tenant_id = 1 and user_id = 1`))

	mg.AddMigration("Alter table rename col deleted to is_deleted", NewRawSQLMigration(`
		Alter table rms_metadata_view_list rename column deleted to is_deleted
	`))

	mg.AddMigration("Alter table rename col back to deleted from is_deleted", NewRawSQLMigration(`
		Alter table rms_metadata_view_list rename column is_deleted to deleted
	`))

	mg.AddMigration("drop existing index UQE_rms_metadata_view_list_name_tenant_id v2", NewRawSQLMigration(`
		DROP INDEX if exists UQE_rms_metadata_view_list_name_tenant_id
	`))

	mg.AddMigration("add index on rms_metadata_view_list name and tenant_id if not present already (delete not included)",
		NewRawSQLMigration(`
			CREATE UNIQUE INDEX if not exists
			UQE_rms_metadata_view_list_name_tenant_id
				ON
			rms_metadata_view_list (name, tenant_id)
		`))

	mg.AddMigration("Alter table rename col back to is_deleted from deleted v2", NewRawSQLMigration(`
		Alter table rms_metadata_view_list rename column deleted to is_deleted
	`))

	mg.AddMigration("ALTER rms_metadata_view_list, ADD COLUMN description", NewAddColumnMigration(metaDataTableV1, &Column{
		Name: "description", Type: DB_Text, Nullable: true, Default: "",
	}))

	// Gen AI related migrations: Add descriptions to OOTB views
	mg.AddMigration("UPDATE rms_metadata_view_list.Incident Management: set description V1",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Incident Management' AND tenant_id = 1`, cleanString(IncidentManagementDescription)...),
		),
	)

	mg.AddMigration("UPDATE rms_metadata_view_list.Incident Management: set description V2",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Incident Management' AND tenant_id = 1`, cleanString(IncidentManagementDescription)...),
		),
	)

	mg.AddMigration("UPDATE rms_metadata_view_list.Change Management: set description V1",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Change Management' AND tenant_id = 1`, cleanString(ChangeManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Problem Management: set description V1",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Problem Management' AND tenant_id = 1`, cleanString(ProblemManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Problem Management: set description V2",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Problem Management' AND tenant_id = 1`, cleanString(ProblemManagementDescription)...),
		),
	)

	mg.AddMigration("UPDATE rms_metadata_view_list.Digital Workplace: set description V1",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Digital Workplace' AND tenant_id = 1`, cleanString(DigitalWorkplaceDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Service Level Management: set description V1",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Service Level Management' AND tenant_id = 1`, cleanString(ServiceLevelManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Configuration Management GenAI Ready: set description V1",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Configuration Management GenAI Ready' AND tenant_id = 1`, cleanString(ConfigurationManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Asset Management: set description V1",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Asset Management' AND tenant_id = 1`, cleanString(AssetManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.BWF Case Management: set description V1",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'BWF Case Management' AND tenant_id = 1`, cleanString(BWFCaseManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.BWF Case Management: set description V2",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'BWF Case Management' AND tenant_id = 1`, cleanString(BWFCaseManagementDescription)...),
		),
	)

	mg.AddMigration("UPDATE rms_metadata_view_list.Change Management: set description V2",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Change Management' AND tenant_id = 1`, cleanString(ChangeManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Change Management: set description V3",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
		SET description = '%s'
		WHERE name = 'Change Management' AND tenant_id = 1`, cleanString(ChangeManagementDescription)...),
		),
	)

	mg.AddMigration("UPDATE rms_metadata_view_list.Configuration Management GenAI Ready: set description V2",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Configuration Management GenAI Ready' AND tenant_id = 1`, cleanString(ConfigurationManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Task Management: set description V1",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Task Management' AND tenant_id = 1`, cleanString(TaskManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Task Management: set description V2",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Task Management' AND tenant_id = 1`, cleanString(TaskManagementDescription)...),
		),
	)

	mg.AddMigration("UPDATE rms_metadata_view_list.Work Order Management: set description V1",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Work Order Management' AND tenant_id = 1`, cleanString(WorkOrderManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Release Management: set description V1",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Release Management' AND tenant_id = 1`, cleanString(ReleaseManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Release Management: set description V2",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Release Management' AND tenant_id = 1`, cleanString(ReleaseManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Digital Workplace: set description V2",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Digital Workplace' AND tenant_id = 1`, cleanString(DigitalWorkplaceDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Asset Management: set description V2",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Asset Management' AND tenant_id = 1`, cleanString(AssetManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Configuration Management GenAI Ready: set description V3",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Configuration Management GenAI Ready' AND tenant_id = 1`, cleanString(ConfigurationManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Asset Management: set description V3",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Asset Management' AND tenant_id = 1`, cleanString(AssetManagementDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.Service Management Foundation: set description V1",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'Service Management Foundation' AND tenant_id = 1`, cleanString(ServiceManagementFoundationDescription)...),
		),
	)
	mg.AddMigration("UPDATE rms_metadata_view_list.BWF Knowledge Management: set description V1",
		NewRawSQLMigration(fmt.Sprintf(`UPDATE rms_metadata_view_list
			SET description = '%s'
			WHERE name = 'BWF Knowledge Management' AND tenant_id = 1`, BWFKnowledgeManagementDescription),
		),
	)
}
