package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addExploreWorkspaces(mg *Migrator) {
	exploreWorkspaceV1 := Table{
		Name: "explore_workspace",
		Columns: []*Column{
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false, IsPrimaryKey: true},
			{Name: "name", Type: DB_NVarchar, Length: 100, Nullable: false},
			{Name: "description", Type: DB_NVarchar, Length: 100, Nullable: false},
			{Name: "active_snapshot_uid", Type: DB_NVarchar, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
		},
	}

	exploreWorkspaceSnapshotV1 := Table{
		Name: "explore_workspace_snapshot",
		Columns: []*Column{
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false, IsPrimaryKey: true},
			{Name: "explore_workspace_uid", Type: DB_NVarchar, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 100, Nullable: false},
			{Name: "description", Type: DB_NVarchar, Length: 100, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: true},
			{Name: "config", Type: DB_Text, Nullable: true},
		},
	}

	mg.AddMigration("create explore workspace table v1", NewAddTableMigration(exploreWorkspaceV1))
	mg.AddMigration("create explore workspace snapshot table v1", NewAddTableMigration(exploreWorkspaceSnapshotV1))
}
