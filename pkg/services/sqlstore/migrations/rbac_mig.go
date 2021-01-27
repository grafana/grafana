package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addRBACMigrations(mg *Migrator) {
	accessRuleV1 := Table{
		Name: "access_rule",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "org_id", Type: DB_BigInt},
			{Name: "policy_id", Type: DB_BigInt},
			{Name: "resource", Type: DB_Varchar, Length: 190, Nullable: false},
			{Name: "action", Type: DB_Varchar, Length: 20, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"policy_id"}},
		},
	}

	mg.AddMigration("create access_rule table", NewAddTableMigration(accessRuleV1))

	//-------  indexes ------------------
	mg.AddMigration("add index access_rule.org_id", NewAddIndexMigration(accessRuleV1, accessRuleV1.Indices[0]))
	mg.AddMigration("add unique index access_rule.policy_id", NewAddIndexMigration(accessRuleV1, accessRuleV1.Indices[1]))

	policyV1 := Table{
		Name: "policy",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "description", Type: DB_Text, Nullable: true},
			{Name: "org_id", Type: DB_BigInt},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "name"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create policy table", NewAddTableMigration(policyV1))

	//-------  indexes ------------------
	mg.AddMigration("add index policy.org_id", NewAddIndexMigration(policyV1, policyV1.Indices[0]))
	mg.AddMigration("add unique index policy_org_id_name", NewAddIndexMigration(policyV1, policyV1.Indices[1]))

	// Or rolePolicy? Role == Team in this case
	teamPolicyV1 := Table{
		Name: "team_policy",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt},
			{Name: "team_id", Type: DB_BigInt},
			{Name: "policy_id", Type: DB_BigInt},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "team_id", "policy_id"}, Type: UniqueIndex},
			{Cols: []string{"team_id"}},
		},
	}

	mg.AddMigration("create team policy table", NewAddTableMigration(teamPolicyV1))

	//-------  indexes ------------------
	mg.AddMigration("add index team_policy.org_id", NewAddIndexMigration(teamPolicyV1, teamPolicyV1.Indices[0]))
	mg.AddMigration("add unique index team_policy_org_id_team_id_policy_id", NewAddIndexMigration(teamPolicyV1, teamPolicyV1.Indices[1]))
	mg.AddMigration("add index team_policy.team_id", NewAddIndexMigration(teamPolicyV1, teamPolicyV1.Indices[2]))
}
