package accesscontrol

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const CodeMigrationSQL = "code migration"

func AddMigration(mg *migrator.Migrator) {
	permissionV1 := migrator.Table{
		Name: "permission",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "role_id", Type: migrator.DB_BigInt},
			{Name: "action", Type: migrator.DB_Varchar, Length: 190, Nullable: false},
			{Name: "scope", Type: migrator.DB_Varchar, Length: 190, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"role_id"}},
			{Cols: []string{"role_id", "action", "scope"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create permission table", migrator.NewAddTableMigration(permissionV1))

	//-------  indexes ------------------
	mg.AddMigration("add unique index permission.role_id", migrator.NewAddIndexMigration(permissionV1, permissionV1.Indices[0]))
	mg.AddMigration("add unique index role_id_action_scope", migrator.NewAddIndexMigration(permissionV1, permissionV1.Indices[1]))

	roleV1 := migrator.Table{
		Name: "role",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "description", Type: migrator.DB_Text, Nullable: true},
			{Name: "version", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "org_id", Type: migrator.DB_BigInt},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "name"}, Type: migrator.UniqueIndex},
			{Cols: []string{"org_id", "uid"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create role table", migrator.NewAddTableMigration(roleV1))

	mg.AddMigration("add column display_name", migrator.NewAddColumnMigration(roleV1, &migrator.Column{
		Name: "display_name", Type: migrator.DB_NVarchar, Length: 190, Nullable: true,
	}))

	mg.AddMigration("add column group_name", migrator.NewAddColumnMigration(roleV1, &migrator.Column{
		Name: "group_name", Type: migrator.DB_NVarchar, Length: 190, Nullable: true,
	}))
	//-------  indexes ------------------
	mg.AddMigration("add index role.org_id", migrator.NewAddIndexMigration(roleV1, roleV1.Indices[0]))
	mg.AddMigration("add unique index role_org_id_name", migrator.NewAddIndexMigration(roleV1, roleV1.Indices[1]))
	mg.AddMigration("add index role_org_id_uid", migrator.NewAddIndexMigration(roleV1, roleV1.Indices[2]))

	teamRoleV1 := migrator.Table{
		Name: "team_role",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt},
			{Name: "team_id", Type: migrator.DB_BigInt},
			{Name: "role_id", Type: migrator.DB_BigInt},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "team_id", "role_id"}, Type: migrator.UniqueIndex},
			{Cols: []string{"team_id"}},
		},
	}

	mg.AddMigration("create team role table", migrator.NewAddTableMigration(teamRoleV1))

	//-------  indexes ------------------
	mg.AddMigration("add index team_role.org_id", migrator.NewAddIndexMigration(teamRoleV1, teamRoleV1.Indices[0]))
	mg.AddMigration("add unique index team_role_org_id_team_id_role_id", migrator.NewAddIndexMigration(teamRoleV1, teamRoleV1.Indices[1]))
	mg.AddMigration("add index team_role.team_id", migrator.NewAddIndexMigration(teamRoleV1, teamRoleV1.Indices[2]))

	userRoleV1 := migrator.Table{
		Name: "user_role",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt},
			{Name: "user_id", Type: migrator.DB_BigInt},
			{Name: "role_id", Type: migrator.DB_BigInt},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "user_id", "role_id"}, Type: migrator.UniqueIndex},
			{Cols: []string{"user_id"}},
		},
	}

	mg.AddMigration("create user role table", migrator.NewAddTableMigration(userRoleV1))

	//-------  indexes ------------------
	mg.AddMigration("add index user_role.org_id", migrator.NewAddIndexMigration(userRoleV1, userRoleV1.Indices[0]))
	mg.AddMigration("add unique index user_role_org_id_user_id_role_id", migrator.NewAddIndexMigration(userRoleV1, userRoleV1.Indices[1]))
	mg.AddMigration("add index user_role.user_id", migrator.NewAddIndexMigration(userRoleV1, userRoleV1.Indices[2]))

	builtinRoleV1 := migrator.Table{
		Name: "builtin_role",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "role", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "role_id", Type: migrator.DB_BigInt},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"role_id"}},
			{Cols: []string{"role"}},
		},
	}

	mg.AddMigration("create builtin role table", migrator.NewAddTableMigration(builtinRoleV1))

	//-------  indexes ------------------
	mg.AddMigration("add index builtin_role.role_id", migrator.NewAddIndexMigration(builtinRoleV1, builtinRoleV1.Indices[0]))
	mg.AddMigration("add index builtin_role.name", migrator.NewAddIndexMigration(builtinRoleV1, builtinRoleV1.Indices[1]))

	// Add org_id column to the builtin_role table
	mg.AddMigration("Add column org_id to builtin_role table", migrator.NewAddColumnMigration(builtinRoleV1, &migrator.Column{
		Name: "org_id", Type: migrator.DB_BigInt, Default: "0",
	}))

	mg.AddMigration("add index builtin_role.org_id", migrator.NewAddIndexMigration(builtinRoleV1, &migrator.Index{
		Cols: []string{"org_id"},
	}))

	mg.AddMigration("add unique index builtin_role_org_id_role_id_role", migrator.NewAddIndexMigration(builtinRoleV1, &migrator.Index{
		Cols: []string{"org_id", "role_id", "role"}, Type: migrator.UniqueIndex,
	}))

	// Make role.uid unique across Grafana instance
	mg.AddMigration("Remove unique index role_org_id_uid", migrator.NewDropIndexMigration(roleV1, &migrator.Index{
		Cols: []string{"org_id", "uid"}, Type: migrator.UniqueIndex,
	}))

	mg.AddMigration("add unique index role.uid", migrator.NewAddIndexMigration(roleV1, &migrator.Index{
		Cols: []string{"uid"}, Type: migrator.UniqueIndex,
	}))

	seedAssignmentV1 := migrator.Table{
		Name: "seed_assignment",
		Columns: []*migrator.Column{
			{Name: "builtin_role", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "role_name", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"builtin_role", "role_name"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create seed assignment table", migrator.NewAddTableMigration(seedAssignmentV1))

	//-------  indexes ------------------
	mg.AddMigration("add unique index builtin_role_role_name", migrator.NewAddIndexMigration(seedAssignmentV1, seedAssignmentV1.Indices[0]))

	mg.AddMigration("add column hidden to role table", migrator.NewAddColumnMigration(roleV1, &migrator.Column{
		Name: "hidden", Type: migrator.DB_Bool, Nullable: false, Default: "0",
	}))

	mg.AddMigration("permission kind migration", migrator.NewAddColumnMigration(permissionV1, &migrator.Column{
		Name: "kind", Type: migrator.DB_NVarchar, Length: 40, Default: "''",
	}))

	mg.AddMigration("permission attribute migration", migrator.NewAddColumnMigration(permissionV1, &migrator.Column{
		Name: "attribute", Type: migrator.DB_NVarchar, Length: 40, Default: "''",
	}))

	mg.AddMigration("permission identifier migration", migrator.NewAddColumnMigration(permissionV1, &migrator.Column{
		Name: "identifier", Type: migrator.DB_NVarchar, Length: 40, Default: "''",
	}))

	mg.AddMigration("add permission identifier index", migrator.NewAddIndexMigration(permissionV1, &migrator.Index{
		Cols: []string{"identifier"},
	}))

	mg.AddMigration("add permission action scope role_id index", migrator.NewAddIndexMigration(permissionV1, &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"action", "scope", "role_id"},
	}))

	mg.AddMigration("remove permission role_id action scope index", migrator.NewDropIndexMigration(permissionV1, &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"role_id", "action", "scope"},
	}))

	mg.AddMigration("add group mapping UID column to user_role table", migrator.NewAddColumnMigration(userRoleV1, &migrator.Column{
		Name: "group_mapping_uid", Type: migrator.DB_NVarchar, Length: 40, Default: "''", Nullable: true,
	}))

	mg.AddMigration("add user_role org ID, user ID, role ID, group mapping UID index", migrator.NewAddIndexMigration(userRoleV1, &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"org_id", "user_id", "role_id", "group_mapping_uid"},
	}))

	mg.AddMigration("remove user_role org ID, user ID, role ID index", migrator.NewDropIndexMigration(userRoleV1, &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"org_id", "user_id", "role_id"},
	}))

	mg.AddMigration("add permission role_id action index", migrator.NewAddIndexMigration(permissionV1, &migrator.Index{
		Cols: []string{"role_id", "action"},
	}))
}
