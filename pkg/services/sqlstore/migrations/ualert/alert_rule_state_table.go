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

// AddAlertRuleStateBigIntMigration widens alert_rule_state.id to bigint on PostgreSQL.
//
// The migrator maps DB_BigInt with IsAutoIncrement to SERIAL (integer, max 2^31-1)
// instead of BIGSERIAL (bigint), so the id column and its sequence are only 32-bit.
// The periodic full-sync (DELETE + re-INSERT) burns through sequence values rapidly,
// causing the sequence to overflow on busy installations. MySQL and SQLite already
// store the column as a 64-bit integer, so this only affects PostgreSQL.
func AddAlertRuleStateBigIntMigration(mg *migrator.Migrator) {
	// Each statement is its own migration: a raw SQL migration runs as a single Exec,
	// and PostgreSQL does not support multiple semicolon-separated statements in one Exec.
	mg.AddMigration("alter alert_rule_state id column to bigint for postgres", migrator.NewRawSQLMigration("").
		Postgres("ALTER TABLE alert_rule_state ALTER COLUMN id TYPE BIGINT;"))
	mg.AddMigration("alter alert_rule_state id sequence to bigint for postgres", migrator.NewRawSQLMigration("").
		Postgres("ALTER SEQUENCE alert_rule_state_id_seq AS BIGINT;"))
}
