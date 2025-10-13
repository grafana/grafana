package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardSnapshotMigrations(mg *Migrator) {
	snapshotV4 := Table{
		Name: "dashboard_snapshot",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "key", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "dashboard", Type: DB_Text, Nullable: false},
			{Name: "expires", Type: DB_DateTime, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"key"}, Type: UniqueIndex},
		},
	}

	// add v4
	mg.AddMigration("create dashboard_snapshot table v4", NewAddTableMigration(snapshotV4))
	mg.AddMigration("drop table dashboard_snapshot_v4 #1", NewDropTableMigration("dashboard_snapshot"))

	snapshotV5 := Table{
		Name: "dashboard_snapshot",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "key", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "delete_key", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "external", Type: DB_Bool, Nullable: false},
			{Name: "external_url", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "dashboard", Type: DB_Text, Nullable: false},
			{Name: "expires", Type: DB_DateTime, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"key"}, Type: UniqueIndex},
			{Cols: []string{"delete_key"}, Type: UniqueIndex},
			{Cols: []string{"user_id"}},
		},
	}

	mg.AddMigration("create dashboard_snapshot table v5 #2", NewAddTableMigration(snapshotV5))
	addTableIndicesMigrations(mg, "v5", snapshotV5)

	// change column type of dashboard
	mg.AddMigration("alter dashboard_snapshot to mediumtext v2", NewRawSQLMigration("").
		Mysql("ALTER TABLE dashboard_snapshot MODIFY dashboard MEDIUMTEXT;"))

	mg.AddMigration("Update dashboard_snapshot table charset", NewTableCharsetMigration("dashboard_snapshot", []*Column{
		{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
		{Name: "key", Type: DB_NVarchar, Length: 190, Nullable: false},
		{Name: "delete_key", Type: DB_NVarchar, Length: 190, Nullable: false},
		{Name: "external_url", Type: DB_NVarchar, Length: 255, Nullable: false},
		{Name: "dashboard", Type: DB_MediumText, Nullable: false},
	}))

	mg.AddMigration("Add column external_delete_url to dashboard_snapshots table", NewAddColumnMigration(snapshotV5, &Column{
		Name: "external_delete_url", Type: DB_NVarchar, Length: 255, Nullable: true,
	}))

	mg.AddMigration("Add encrypted dashboard json column", NewAddColumnMigration(snapshotV5, &Column{
		Name: "dashboard_encrypted", Type: DB_Blob, Nullable: true,
	}))

	mg.AddMigration("Change dashboard_encrypted column to MEDIUMBLOB", NewRawSQLMigration("").
		Mysql("ALTER TABLE dashboard_snapshot MODIFY dashboard_encrypted MEDIUMBLOB;"))
}
