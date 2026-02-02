package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addReportEventsMigrations(mg *Migrator) {

	//------------------  report_events table -------------------
	reportDataV1 := Table{
		Name: "report_events",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "message_id", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "tenant_id", Type: DB_BigInt, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "description", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "dashboard_uid", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "time_range_from", Type: DB_NVarchar, Length: 32, Nullable: false},
			{Name: "time_range_to", Type: DB_NVarchar, Length: 32, Nullable: false},
			{Name: "filter", Type: DB_Text, Nullable: true},
			{Name: "layout", Type: DB_NVarchar, Length: 50, Nullable: true},
			{Name: "orientation", Type: DB_NVarchar, Length: 10, Nullable: true},
			{Name: "report_type", Type: DB_NVarchar, Length: 5, Nullable: false, Default: "'pdf'"},
			{Name: "has_date_stamp", Type: DB_Bool, Nullable: true},
			{Name: "has_time_stamp", Type: DB_Bool, Nullable: true},
			{Name: "compress_attachment", Type: DB_Bool, Nullable: true},
			{Name: "status", Type: DB_NVarchar, Length: 100, Nullable: false},
			{Name: "error_msg", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "theme", Type: DB_NVarchar, Length: 50, Nullable: false},
			{Name: "timezone", Type: DB_NVarchar, Length: 64, Nullable: false},
			{Name: "created_at", Type: DB_DateTime, Nullable: false},
			{Name: "last_updated_at", Type: DB_DateTime, Nullable: false},
			{Name: "csv_delimiter", Type: DB_Char, Nullable: true, Default: "''"},
		},
		Indices: []*Index{},
	}
	mg.AddMigration("create report_events table v1", NewAddTableMigration(reportDataV1))
	// add a column no_data_condition, Conditional Broadcasting- Empty report generation flag
	mg.AddMigration("Add column no_data_condition in report_events", NewAddColumnMigration(reportDataV1, &Column{
		Name: "no_data_condition", Type: DB_Bool, Nullable: true,
	}))
}
