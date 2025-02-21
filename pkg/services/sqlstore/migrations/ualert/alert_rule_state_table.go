package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddAlertRuleStateTable adds column to store alert rule state data.
func AddAlertRuleStateTable(mg *migrator.Migrator) {
	alertStateTable := migrator.Table{
		Name: "alert_rule_state",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "rule_uid", Type: migrator.DB_NVarchar, Length: UIDMaxLength, Nullable: false},
			{Name: "data", Type: migrator.DB_LongBlob, Nullable: false},
			{Name: "updated_at", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id", "rule_uid"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration(
		"add alert_rule_state table",
		migrator.NewAddTableMigration(alertStateTable),
	)
	mg.AddMigration(
		"add index to alert_rule_state on org_id and rule_uid columns",
		migrator.NewAddIndexMigration(alertStateTable, alertStateTable.Indices[0]),
	)
}
