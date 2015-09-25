package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addQuotaMigration(mg *Migrator) {

	var quotaV1 = Table{
		Name: "quota",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "target", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "limit", Type: DB_BigInt, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "target"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create quota table v1", NewAddTableMigration(quotaV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", quotaV1)

	// move to new table schema.
	//-------  drop indexes ------------------
	addDropAllIndicesMigrations(mg, "v1", quotaV1)

	//------- rename table ------------------
	addTableRenameMigration(mg, "quota", "quota_v1", "v1")

	var quotaV2 = Table{
		Name: "quota",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: true},
			{Name: "user_id", Type: DB_BigInt, Nullable: true},
			{Name: "target", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "limit", Type: DB_BigInt, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "user_id", "target"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create quota table v2", NewAddTableMigration(quotaV2))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v2", quotaV2)

	//------- copy data from v1 to v2 -------------------
	mg.AddMigration("copy quota v1 to v2", NewCopyTableDataMigration("quota", "quota_v1", map[string]string{
		"id":      "id",
		"org_id":  "org_id",
		"target":  "target",
		"limit":   "limit",
		"created": "created",
		"updated": "updated",
	}))
	mg.AddMigration("Drop old table quota_v1", NewDropTableMigration("quota_v1"))
}
