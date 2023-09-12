package anonservice

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func AddMigration(mg *migrator.Migrator) {
	var anonV1 = migrator.Table{
		Name: "anon_device",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "client_ip", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "created_at", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "device_id", Type: migrator.DB_NVarchar, Length: 127, Nullable: false},
			{Name: "updated_at", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "user_agent", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"device_id"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create anon_device table", migrator.NewAddTableMigration(anonV1))
	mg.AddMigration("add unique index anon_device.device_id", migrator.NewAddIndexMigration(anonV1, anonV1.Indices[0]))
}
