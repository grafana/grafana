package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addServerlockMigrations(mg *migrator.Migrator) {
	serverLock := migrator.Table{
		Name: "server_lock",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "operation_uid", Type: migrator.DB_NVarchar, Length: 100},
			{Name: "version", Type: migrator.DB_BigInt},
			{Name: "last_execution", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"operation_uid"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create server_lock table", migrator.NewAddTableMigration(serverLock))

	mg.AddMigration("add index server_lock.operation_uid", migrator.NewAddIndexMigration(serverLock, serverLock.Indices[0]))
}
