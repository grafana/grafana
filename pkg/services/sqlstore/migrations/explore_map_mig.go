package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addExploreMapMigrations(mg *Migrator) {
	exploreMapV1 := Table{
		Name: "explore_map",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "data", Type: DB_Text, Nullable: false},
			{Name: "created_by", Type: DB_BigInt, Nullable: false},
			{Name: "updated_by", Type: DB_BigInt, Nullable: false},
			{Name: "created_at", Type: DB_DateTime, Nullable: false},
			{Name: "updated_at", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"uid", "org_id"}, Type: UniqueIndex},
			{Cols: []string{"org_id"}},
		},
	}

	mg.AddMigration("create explore_map table", NewAddTableMigration(exploreMapV1))
	mg.AddMigration("add unique index explore_map.uid_org_id", NewAddIndexMigration(exploreMapV1, exploreMapV1.Indices[0]))
	mg.AddMigration("add index explore_map.org_id", NewAddIndexMigration(exploreMapV1, exploreMapV1.Indices[1]))
}
