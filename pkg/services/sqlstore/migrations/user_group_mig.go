package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addUserGroupMigrations(mg *Migrator) {
	userGroupV1 := Table{
		Name: "user_group",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "org_id", Type: DB_BigInt},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "name"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create user group table", NewAddTableMigration(userGroupV1))

	//-------  indexes ------------------
	mg.AddMigration("add index user_group.org_id", NewAddIndexMigration(userGroupV1, userGroupV1.Indices[0]))
	mg.AddMigration("add unique index user_group_org_id_name", NewAddIndexMigration(userGroupV1, userGroupV1.Indices[1]))

	userGroupMemberV1 := Table{
		Name: "user_group_member",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt},
			{Name: "user_group_id", Type: DB_BigInt},
			{Name: "user_id", Type: DB_BigInt},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "user_group_id", "user_id"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create user group member table", NewAddTableMigration(userGroupMemberV1))

	//-------  indexes ------------------
	mg.AddMigration("add index user_group_member.org_id", NewAddIndexMigration(userGroupMemberV1, userGroupMemberV1.Indices[0]))
	mg.AddMigration("add unique index user_group_member_org_id_user_group_id_user_id", NewAddIndexMigration(userGroupMemberV1, userGroupMemberV1.Indices[1]))
}
