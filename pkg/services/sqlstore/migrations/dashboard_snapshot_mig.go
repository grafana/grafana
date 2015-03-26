package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardSnapshotMigrations(mg *Migrator) {
	snapshotV4 := Table{
		Name: "dashboard_snapshot",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "key", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "dashboard", Type: DB_Text, Nullable: false},
			{Name: "expires", Type: DB_DateTime, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"key"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create dashboard_snapshot table v4", NewAddTableMigration(snapshotV4))
	addTableIndicesMigrations(mg, "v4", snapshotV4)

	mg.AddMigration("add org_id to dashboard_snapshot", new(AddColumnMigration).
		Table("dashboard_snapshot").Column(&Column{Name: "org_id", Type: DB_BigInt, Nullable: true}))

	mg.AddMigration("add index org_id to dashboard_snapshot",
		NewAddIndexMigration(snapshotV4, &Index{Cols: []string{"org_id"}}))
}
