package rbac

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addRBACMigrations(mg *migrator.Migrator) {
	permissionV1 := migrator.Table{
		Name: "permission",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "policy_id", Type: migrator.DB_BigInt},
			{Name: "permission", Type: migrator.DB_Varchar, Length: 190, Nullable: false},
			{Name: "scope", Type: migrator.DB_Varchar, Length: 190, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"policy_id"}},
		},
	}

	mg.AddMigration("create permission table", migrator.NewAddTableMigration(permissionV1))

	//-------  indexes ------------------
	mg.AddMigration("add unique index permission.policy_id", migrator.NewAddIndexMigration(permissionV1, permissionV1.Indices[0]))

	policyV1 := migrator.Table{
		Name: "policy",
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

	mg.AddMigration("create policy table", migrator.NewAddTableMigration(policyV1))

	//-------  indexes ------------------
	mg.AddMigration("add index policy.org_id", migrator.NewAddIndexMigration(policyV1, policyV1.Indices[0]))
	mg.AddMigration("add unique index policy_org_id_name", migrator.NewAddIndexMigration(policyV1, policyV1.Indices[1]))
	mg.AddMigration("add index policy_org_id_uid", migrator.NewAddIndexMigration(policyV1, policyV1.Indices[2]))

	// Or rolePolicy? Role == Team in this case
	teamPolicyV1 := migrator.Table{
		Name: "team_policy",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt},
			{Name: "team_id", Type: migrator.DB_BigInt},
			{Name: "policy_id", Type: migrator.DB_BigInt},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			// TODO: looks like we dont't really need this field since policy assignment only can be created or removed
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "team_id", "policy_id"}, Type: migrator.UniqueIndex},
			{Cols: []string{"team_id"}},
		},
	}

	mg.AddMigration("create team policy table", migrator.NewAddTableMigration(teamPolicyV1))

	//-------  indexes ------------------
	mg.AddMigration("add index team_policy.org_id", migrator.NewAddIndexMigration(teamPolicyV1, teamPolicyV1.Indices[0]))
	mg.AddMigration("add unique index team_policy_org_id_team_id_policy_id", migrator.NewAddIndexMigration(teamPolicyV1, teamPolicyV1.Indices[1]))
	mg.AddMigration("add index team_policy.team_id", migrator.NewAddIndexMigration(teamPolicyV1, teamPolicyV1.Indices[2]))

	userPolicyV1 := migrator.Table{
		Name: "user_policy",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt},
			{Name: "user_id", Type: migrator.DB_BigInt},
			{Name: "policy_id", Type: migrator.DB_BigInt},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			// TODO: looks like we dont't really need this field since policy assignment only can be created or removed
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "user_id", "policy_id"}, Type: migrator.UniqueIndex},
			{Cols: []string{"user_id"}},
		},
	}

	mg.AddMigration("create user policy table", migrator.NewAddTableMigration(userPolicyV1))

	//-------  indexes ------------------
	mg.AddMigration("add index user_policy.org_id", migrator.NewAddIndexMigration(userPolicyV1, userPolicyV1.Indices[0]))
	mg.AddMigration("add unique index user_policy_org_id_user_id_policy_id", migrator.NewAddIndexMigration(userPolicyV1, userPolicyV1.Indices[1]))
	mg.AddMigration("add index user_policy.user_id", migrator.NewAddIndexMigration(userPolicyV1, userPolicyV1.Indices[2]))

	builtinRolePolicyV1 := migrator.Table{
		Name: "builtin_role_policy",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "role", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "policy_id", Type: migrator.DB_BigInt},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"policy_id"}},
			{Cols: []string{"role"}},
		},
	}

	mg.AddMigration("create builtin role policy table", migrator.NewAddTableMigration(builtinRolePolicyV1))

	//-------  indexes ------------------
	mg.AddMigration("add index builtin_role_policy.policy_id", migrator.NewAddIndexMigration(builtinRolePolicyV1, builtinRolePolicyV1.Indices[0]))
	mg.AddMigration("add index builtin_role_policy.name", migrator.NewAddIndexMigration(builtinRolePolicyV1, builtinRolePolicyV1.Indices[1]))
}
