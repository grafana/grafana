package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addAuditMigrations(mg *Migrator) {
	auditV1 := Table{
		Name: "audit_record",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "username", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "action", Type: DB_Text, Nullable: false},
			{Name: "created_at", Type: DB_DateTime, Nullable: false},
			{Name: "ip_address", Type: DB_NVarchar, Length: 40, Nullable: false},
		},
	}

	mg.AddMigration("create audit_record table v1", NewAddTableMigration(auditV1))
}
