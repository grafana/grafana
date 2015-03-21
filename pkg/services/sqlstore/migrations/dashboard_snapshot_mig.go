package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardSnapshotMigrations(mg *Migrator) {
	snapshotV3 := Table{
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

	mg.AddMigration("create dashboard_snapshot table v3", NewAddTableMigration(snapshotV3))
	addTableIndicesMigrations(mg, "v3", snapshotV3)
}
