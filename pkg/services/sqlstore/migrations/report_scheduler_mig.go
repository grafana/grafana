package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addReportSchedulerMigrations(mg *Migrator) {

	//------------------  report_data table -------------------
	reportDataV1 := Table{
		Name: "report_data",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "description", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
			{Name: "time_range", Type: DB_NVarchar, Length: 32, Nullable: true},
			{Name: "filter", Type: DB_Text, Nullable: true},
			{Name: "recipients", Type: DB_Text, Nullable: false},
			{Name: "reply_to", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "subject", Type: DB_Text, Nullable: true},
			{Name: "message", Type: DB_Text, Nullable: true},
			{Name: "layout", Type: DB_NVarchar, Length: 50, Nullable: true},
			{Name: "orientation", Type: DB_NVarchar, Length: 10, Nullable: true},
			{Name: "created_at", Type: DB_DateTime, Nullable: false},
			{Name: "updated_at", Type: DB_DateTime, Nullable: false},
			{Name: "next_at", Type: DB_BigInt, Nullable: true},
			{Name: "last_at", Type: DB_BigInt, Nullable: true},
			{Name: "enabled", Type: DB_Bool, Nullable: false},
			{Name: "report_scheduler_id", Type: DB_BigInt, Nullable: true},
			{Name: "report_settings_id", Type: DB_BigInt, Nullable: true},
		},
		Indices: []*Index{},
	}
	mg.AddMigration("create report_data table v3", NewAddTableMigration(reportDataV1))

	// add column reportType
	mg.AddMigration("Add column report_type in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "report_type", Type: DB_NVarchar, Length: 5, Nullable: false, Default: "'pdf'",
	}))

	// add column schedule_type & server_dir, Extended support for FTP protocol
	mg.AddMigration("Add column schedule_type in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "schedule_type", Type: DB_NVarchar, Length: 5, Nullable: false, Default: "'email'",
	}))
	mg.AddMigration("Add column server_dir in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "server_dir", Type: DB_NVarchar, Length: 265, Nullable: true,
	}))
	mg.AddMigration("Add column has_date_stamp in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "has_date_stamp", Type: DB_Bool, Nullable: true,
	}))
	mg.AddMigration("Add column date_stamp_format in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "date_stamp_format", Type: DB_NVarchar, Nullable: true, Default: "'MM-DD-YYYY'",
	}))
	mg.AddMigration("Add column has_time_stamp in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "has_time_stamp", Type: DB_Bool, Nullable: true,
	}))
	// add column compressAttachment
	mg.AddMigration("Add column compress_attachment in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "compress_attachment", Type: DB_Bool, Nullable: true,
	}))
	// add column bcc_recipients
	mg.AddMigration("Add column bcc_recipients in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "bcc_recipients", Type: DB_Text, Nullable: true,
	}))

	mg.AddMigration("Add column export_options in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name:     "export_options",
		Type:     DB_Text,
		Nullable: true,
		Default:  "''",
	}))

	// Drop NOT NULL constraints
	mg.AddMigration("Drop NOT NULL constraints of column recipients in report_data", NewRawSQLMigration(`ALTER TABLE report_data ALTER COLUMN recipients DROP NOT NULL`))

	// Add NOT NULL constraints on columns recipients and bcc_recipients. Atleast one of them should have value
	mg.AddMigration("Add NOT NULL constraints on columns recipients and bcc_recipients in report_data", NewRawSQLMigration(`ALTER TABLE report_data
                     ADD CONSTRAINT recipients_required
                     CHECK (recipients is NOT NULL or bcc_recipients is NOT NULL);
 `))

	mg.AddMigration("Add column created_by in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "created_by", Type: DB_BigInt, Nullable: true,
	}))

	mg.AddMigration("Copy values from user_id column to a new column created_by", NewRawSQLMigration(`UPDATE report_data SET created_by = user_id;`))

	updateCompressAttachment := "UPDATE report_data SET compress_attachment = CASE WHEN report_type = 'csv' THEN TRUE ELSE FALSE END"
	mg.AddMigration("Update compressAttachment data based on record type", NewRawSQLMigration(updateCompressAttachment))

	//-------  report_scheduler table -------------------
	reportSchedulerV1 := Table{
		Name: "report_scheduler",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "start_from", Type: DB_TimeStamp, Nullable: true},
			{Name: "end_at", Type: DB_TimeStamp, Nullable: true},
			{Name: "cron", Type: DB_Text, Nullable: false},
			{Name: "timezone", Type: DB_NVarchar, Length: 64, Nullable: false},
		}, Indices: []*Index{},
	}
	// ---- Fix to delete older report_scheduler table version ----
	mg.AddMigration("drop old report_scheduler table", NewDropTableMigration(reportSchedulerV1.Name))
	mg.AddMigration("create table report scheduler", NewAddTableMigration(reportSchedulerV1))

	//-------  report_option table -------------------
	reportSettingsV1 := Table{
		Name: "report_settings",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "company_logo_url", Type: DB_Text, Nullable: true},
			{Name: "footer_sent_by", Type: DB_Bool, Nullable: true},
			{Name: "footer_text", Type: DB_Text, Nullable: true},
			{Name: "footer_text_url", Type: DB_Text, Nullable: true},
			{Name: "org_id", Type: DB_Int, Nullable: false},
		},
	}
	mg.AddMigration("create report_settings table v3", NewAddTableMigration(reportSettingsV1))

	//-------  job_queue table -------------------
	reportJobQueueV1 := Table{
		Name: "job_queue",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "started_at", Type: DB_TimeStamp, Nullable: false},
			{Name: "finished_at", Type: DB_TimeStamp, Nullable: true},
			{Name: "elapsed_time", Type: DB_BigInt, Nullable: false},
			{Name: "report_data_id", Type: DB_BigInt, Nullable: false},
		},
	}
	mg.AddMigration("create job_queue table v3", NewAddTableMigration(reportJobQueueV1))

	//-------  job_status table -------------------
	reportJobStatusV1 := Table{
		Name: "job_status",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "date_time", Type: DB_TimeStamp, Nullable: false},
			{Name: "value", Type: DB_Int, Nullable: false},
			{Name: "description", Type: DB_Text, Nullable: true},
			{Name: "job_queue_id", Type: DB_BigInt, Nullable: false},
		},
	}
	mg.AddMigration("create job_status table v3", NewAddTableMigration(reportJobStatusV1))

	mg.AddMigration("Alter scheduler job_queue table, add file_key",
		NewAddColumnMigration(reportJobQueueV1, &Column{Name: "file_key", Type: DB_Text, Nullable: true}))
	mg.AddMigration("Alter scheduler job_queue table, add file_version",
		NewAddColumnMigration(reportJobQueueV1, &Column{Name: "file_version", Type: DB_Text, Nullable: true}))
	mg.AddMigration("Alter scheduler job_queue table, add deleted",
		NewAddColumnMigration(reportJobQueueV1, &Column{Name: "deleted", Type: DB_Bool, Nullable: true, Default: "0"}))

	mg.AddMigration("Alter scheduler settings table, add internal_domains_only",
		NewAddColumnMigration(reportSettingsV1, &Column{Name: "internal_domains_only", Type: DB_Bool, Nullable: false, Default: "false"}))
	mg.AddMigration("Alter scheduler settings table, add whitelisted_domains",
		NewAddColumnMigration(reportSettingsV1, &Column{Name: "whitelisted_domains", Type: DB_Text, Nullable: true}))

	//-------  report_org table -------------------
	reportTenantDetailsV1 := Table{
		Name: "report_tenant_details",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "type", Type: DB_Text, Nullable: false},
			{Name: "limit", Type: DB_Int, Nullable: false},
		},
	}
	mg.AddMigration("create report_tenant_details table v1", NewAddTableMigration(reportTenantDetailsV1))

	//-------  report_ftp_config table -------------------
	reportFtpConfigV1 := Table{
		Name: "report_ftp_config",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "ftp_host", Type: DB_Text, Nullable: true},
			{Name: "ftp_port", Type: DB_Int, Nullable: true},
			{Name: "user_name", Type: DB_Text, Nullable: true},
			{Name: "password", Type: DB_Text, Nullable: true},
		},
	}
	mg.AddMigration("create report_ftp_config table v1", NewAddTableMigration(reportFtpConfigV1))

	mg.AddMigration("Alter table report_data add column time_range_to v1", NewAddColumnMigration(reportDataV1, &Column{
		Name: "time_range_to", Type: DB_Text, Nullable: true, Default: "",
	}))

	mg.AddMigration("Alter table report_settings add column storage_retention v1", NewAddColumnMigration(reportSettingsV1, &Column{
		Name: "storage_retention", Type: DB_Int, Nullable: true, Default: "7",
	}))

	mg.AddMigration("Alter table report_settings add column date_format v1", NewAddColumnMigration(reportSettingsV1, &Column{
		Name: "date_format", Type: DB_Text, Nullable: true, Default: "'DD/MM/YYYY, HH:mm:ss Z z'::text",
	}))

	// add column compressAttachment
	mg.AddMigration("Add column csv_delimiter in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "csv_delimiter", Type: DB_Char, Nullable: true, Default: "''",
	}))

	mg.AddMigration("Add column table_scaling in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "table_scaling", Type: DB_Bool, Nullable: true,
	}))

	// add column report_ftp_config_id
	mg.AddMigration("Alter table report_data add column report_ftp_config_id v1", NewAddColumnMigration(reportDataV1, &Column{
		Name: "report_ftp_config_id", Type: DB_NVarchar, Length: 255, Nullable: true,
	}))

	// add column default_ftp
	mg.AddMigration("Alter table report_ftp_config add column default_ftp v1", NewAddColumnMigration(reportFtpConfigV1, &Column{
		Name: "default_ftp", Type: DB_Bool, Nullable: true,
	}))

	mg.AddMigration("Add unique index report_ftp_config_org_id_ftp", NewAddIndexMigration(reportFtpConfigV1, &Index{
		Cols: []string{"org_id", "ftp_host", "ftp_port", "user_name"}, Type: UniqueIndex,
	}))

	// add a column no_data_condition, Conditional Broadcasting- Empty report generation flag
	mg.AddMigration("Add column no_data_condition in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "no_data_condition", Type: DB_Bool, Nullable: true,
	}))

	// Add Columns to Job Queue - Description, value and error log
	mg.AddMigration("Add column description in job_queue", NewAddColumnMigration(reportJobQueueV1, &Column{
		Name: "description", Type: DB_Text, Nullable: true,
	}))

	// Make the value nullable but already existing records doesnt satisfy it (Cannot make it null as well)
	// Current Values for this Column will be
	// -2 = Skipped, -1 = Failed and 1 - Success
	// 1. Either initially declare it nullable and populate the existing records with this value and then alter and make the column non nullable
	// 2. Set default value that will add a certain value to existing records
	mg.AddMigration("Add column value in job_queue", NewAddColumnMigration(reportJobQueueV1, &Column{
		Name: "value", Type: DB_Int, Nullable: true,
	}))

	mg.AddMigration("Add column error log in job_queue", NewAddColumnMigration(reportJobQueueV1, &Column{
		Name: "err_log", Type: DB_Text, Nullable: true,
	}))

	mg.AddMigration("Add column recipient_mode in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "recipient_mode", Type: DB_NVarchar, Nullable: false, Default: "'static'",
	}))

	mg.AddMigration("Add column is_dynamic_bcc_recipients in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "is_dynamic_bcc_recipients", Type: DB_Bool, Nullable: true,
	}))

	mg.AddMigration("Add column dynamic_recipient_dash_id in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "dynamic_recipient_dash_id", Type: DB_BigInt, Nullable: true,
	}))

	// Drop NOT NULL constraints
	mg.AddMigration("Drop recipients_required constraint in report_data", NewRawSQLMigration(`
	ALTER TABLE report_data
	DROP CONSTRAINT IF EXISTS recipients_required;`))

	mg.AddMigration("Add recipients_required_v2 constraint in report_data", NewRawSQLMigration(`
	ALTER TABLE report_data
	ADD CONSTRAINT recipients_required_v2
	CHECK (
		recipients IS NOT NULL 
		OR bcc_recipients IS NOT NULL 
		OR dynamic_recipient_dash_id IS NOT NULL
	);
`))

	mg.AddMigration("Add column dynamic_recipients in job_queue", NewAddColumnMigration(reportJobQueueV1, &Column{
		Name: "dynamic_recipients", Type: DB_Text, Nullable: true,
	}))

	//-------  report_email_retry table -------------------
	reportEmailRetryV1 := Table{
		Name: "report_email_retry",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "job_id", Type: DB_BigInt, Nullable: false},
			{Name: "report_id", Type: DB_BigInt, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "file_key", Type: DB_Text, Nullable: true},
			{Name: "file_version", Type: DB_Text, Nullable: true},
			{Name: "created_at", Type: DB_BigInt, Nullable: true},
			{Name: "last_at", Type: DB_BigInt, Nullable: true},
			{Name: "retry_count", Type: DB_Int, Nullable: true, Default: "0"},
			{Name: "status", Type: DB_Text, Nullable: true},
			{Name: "error_code", Type: DB_Text, Nullable: true},
		},
		Indices: []*Index{
			{Cols: []string{"job_id"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create report_email_retry table v1", NewAddTableMigration(reportEmailRetryV1))
	mg.AddMigration("add unique index on report_email_retry.job_id", NewAddIndexMigration(reportEmailRetryV1, reportEmailRetryV1.Indices[0]))
	mg.AddMigration("Add column email_data in report_email_retry", NewAddColumnMigration(reportEmailRetryV1, &Column{
		Name: "email_data", Type: DB_Text, Nullable: true,
	}))

	// Dynamic bursting support - Add boolean column to report_data table
	mg.AddMigration("Add column dynamic_bursting in report_data", NewAddColumnMigration(reportDataV1, &Column{
		Name: "dynamic_bursting", Type: DB_Bool, Nullable: true,
	}))
}
