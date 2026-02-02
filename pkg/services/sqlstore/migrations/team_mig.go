package migrations

import (
	"fmt"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"xorm.io/xorm"
)

func addTeamMigrations(mg *Migrator) {
	teamV1 := Table{
		Name: "team",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "org_id", Type: DB_BigInt},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "name"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create team table", NewAddTableMigration(teamV1))

	//-------  indexes ------------------
	mg.AddMigration("add index team.org_id", NewAddIndexMigration(teamV1, teamV1.Indices[0]))
	mg.AddMigration("add unique index team_org_id_name", NewAddIndexMigration(teamV1, teamV1.Indices[1]))

	mg.AddMigration("Add column uid in team", NewAddColumnMigration(teamV1, &Column{
		Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: true,
	}))

	mg.AddMigration("Update uid column values in team", NewRawSQLMigration("").
		SQLite("UPDATE team SET uid=printf('t%09d',id) WHERE uid IS NULL;").
		Postgres("UPDATE team SET uid='t' || lpad('' || id::text,20,'0') WHERE uid IS NULL;").
		Mysql("UPDATE team SET uid=concat('t',lpad(id,20,'0')) WHERE uid IS NULL;"))

	// BMC Change: Start
	// Fail safe for team uid correction, if same exists, before creating new index on uid
	// Assumption: Only postgres used as grafana db
	mg.AddMigration("Make sure team uid are unique", &BMCTeamUIDCorrection{})
	// BMC Change: End

	mg.AddMigration("Add unique index team_org_id_uid", NewAddIndexMigration(teamV1, &Index{
		Cols: []string{"org_id", "uid"}, Type: UniqueIndex,
	}))

	teamMemberV1 := Table{
		Name: "team_member",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt},
			{Name: "team_id", Type: DB_BigInt},
			{Name: "user_id", Type: DB_BigInt},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "team_id", "user_id"}, Type: UniqueIndex},
			{Cols: []string{"team_id"}},
			{Cols: []string{"user_id", "org_id"}},
		},
	}

	mg.AddMigration("create team member table", NewAddTableMigration(teamMemberV1))

	//-------  indexes ------------------
	mg.AddMigration("add index team_member.org_id", NewAddIndexMigration(teamMemberV1, teamMemberV1.Indices[0]))
	mg.AddMigration("add unique index team_member_org_id_team_id_user_id", NewAddIndexMigration(teamMemberV1, teamMemberV1.Indices[1]))
	mg.AddMigration("add index team_member.team_id", NewAddIndexMigration(teamMemberV1, teamMemberV1.Indices[2]))

	// add column email
	mg.AddMigration("Add column email to team table", NewAddColumnMigration(teamV1, &Column{
		Name: "email", Type: DB_NVarchar, Nullable: true, Length: 190,
	}))

	// BMC code - Set default value for IsMspTeam
	mg.AddMigration("Add new column is_msp_team to team table", NewAddColumnMigration(teamV1, &Column{
		Name: "is_msp_team", Type: DB_Bool, Nullable: true, Default: "0",
	}))
	mg.AddMigration("Add new column type to team table", NewAddColumnMigration(teamV1, &Column{
		Name: "type", Type: DB_SmallInt, Nullable: true, Default: "0",
	}))

	mg.AddMigration("Set type=1 for existing msp team ", NewRawSQLMigration("").
		Postgres("UPDATE public.team SET type=1 where is_msp_team=true and type=0"))
	//End BMC Code

	mg.AddMigration("Add column external to team_member table", NewAddColumnMigration(teamMemberV1, &Column{
		Name: "external", Type: DB_Bool, Nullable: true,
	}))

	mg.AddMigration("Add column permission to team_member table", NewAddColumnMigration(teamMemberV1, &Column{
		Name: "permission", Type: DB_SmallInt, Nullable: true,
	}))
	// BMC code
	// Abhishek, 07122020, alter id column to bigint
	mg.AddMigration("alter team.id to bigint", NewRawSQLMigration("").
		Postgres("ALTER TABLE public.team ALTER COLUMN id TYPE int8;"))
	// End
	mg.AddMigration("add unique index team_member_user_id_org_id", NewAddIndexMigration(teamMemberV1, teamMemberV1.Indices[3]))
}

// BMC Code: Start
type BMCTeamUIDCorrection struct {
	MigrationBase
}

func (m *BMCTeamUIDCorrection) SQL(dialect Dialect) string {
	return "code migration"
}

type BMCTempTeamDTO struct {
	Id  int64
	Uid string
}

func (m *BMCTeamUIDCorrection) Exec(sess *xorm.Session, mg *Migrator) error {
	teams := make([]*TempUserDTO, 0)

	err := sess.SQL(fmt.Sprintf("SELECT t1.id, t1.uid from %s as t1 join %s as t2 on t1.uid = t2.uid and t1.id != t2.id", mg.Dialect.Quote("team"), mg.Dialect.Quote("team"))).Find(&teams)
	if err != nil {
		return err
	}

	for _, team := range teams {
		if _, err := sess.Exec("UPDATE "+mg.Dialect.Quote("team")+
			" SET uid='t' || lpad('' || id::text,20,'0') WHERE id = ?", team.Id); err != nil {
			return err
		}
	}
	return nil
}

// BMC Code: End
