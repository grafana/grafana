package migrations

import (
	"fmt"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/usermig"
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util"
)

func addUserMigrations(mg *Migrator) {
	userV1 := Table{
		Name: "user",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "login", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "email", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "password", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "salt", Type: DB_NVarchar, Length: 50, Nullable: true},
			{Name: "rands", Type: DB_NVarchar, Length: 50, Nullable: true},
			{Name: "company", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "account_id", Type: DB_BigInt, Nullable: false},
			{Name: "is_admin", Type: DB_Bool, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"login"}, Type: UniqueIndex},
			{Cols: []string{"email"}, Type: UniqueIndex},
		},
	}

	// create table
	mg.AddMigration("create user table", NewAddTableMigration(userV1))
	// add indices
	mg.AddMigration("add unique index user.login", NewAddIndexMigration(userV1, userV1.Indices[0]))
	mg.AddMigration("add unique index user.email", NewAddIndexMigration(userV1, userV1.Indices[1]))

	// ---------------------
	// account -> org changes

	//-------  drop indexes ------------------
	addDropAllIndicesMigrations(mg, "v1", userV1)

	//------- rename table ------------------
	addTableRenameMigration(mg, "user", "user_v1", "v1")

	//------- recreate table with new column names ------------------
	userV2 := Table{
		Name: "user",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "login", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "email", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "password", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "salt", Type: DB_NVarchar, Length: 50, Nullable: true},
			{Name: "rands", Type: DB_NVarchar, Length: 50, Nullable: true},
			{Name: "company", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "is_admin", Type: DB_Bool, Nullable: false},
			{Name: "email_verified", Type: DB_Bool, Nullable: true},
			{Name: "theme", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"login"}, Type: UniqueIndex},
			{Cols: []string{"email"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create user table v2", NewAddTableMigration(userV2))
	addTableIndicesMigrations(mg, "v2", userV2)

	//------- copy data from v1 to v2 -------------------
	mg.AddMigration("copy data_source v1 to v2", NewCopyTableDataMigration("user", "user_v1", map[string]string{
		"id":       "id",
		"version":  "version",
		"login":    "login",
		"email":    "email",
		"name":     "name",
		"password": "password",
		"salt":     "salt",
		"rands":    "rands",
		"company":  "company",
		"org_id":   "account_id",
		"is_admin": "is_admin",
		"created":  "created",
		"updated":  "updated",
	}))

	mg.AddMigration("Drop old table user_v1", NewDropTableMigration("user_v1"))

	mg.AddMigration("Add column help_flags1 to user table", NewAddColumnMigration(userV2, &Column{
		Name: "help_flags1", Type: DB_BigInt, Nullable: false, Default: "0",
	}))

	mg.AddMigration("Update user table charset", NewTableCharsetMigration("user", []*Column{
		{Name: "login", Type: DB_NVarchar, Length: 190, Nullable: false},
		{Name: "email", Type: DB_NVarchar, Length: 190, Nullable: false},
		{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "password", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "salt", Type: DB_NVarchar, Length: 50, Nullable: true},
		{Name: "rands", Type: DB_NVarchar, Length: 50, Nullable: true},
		{Name: "company", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "theme", Type: DB_NVarchar, Length: 255, Nullable: true},
	}))

	mg.AddMigration("Add last_seen_at column to user", NewAddColumnMigration(userV2, &Column{
		Name: "last_seen_at", Type: DB_DateTime, Nullable: true,
	}))

	// Adds salt & rands for old users who used ldap or oauth
	mg.AddMigration("Add missing user data", &AddMissingUserSaltAndRandsMigration{})

	// is_disabled indicates whether user disabled or not. Disabled user should not be able to log in.
	// This field used in couple with LDAP auth to disable users removed from LDAP rather than delete it immediately.
	mg.AddMigration("Add is_disabled column to user", NewAddColumnMigration(userV2, &Column{
		Name: "is_disabled", Type: DB_Bool, Nullable: false, Default: "0",
	}))

	mg.AddMigration("Add index user.login/user.email", NewAddIndexMigration(userV2, &Index{
		Cols: []string{"login", "email"},
	}))

	//Service accounts are lightweight users with restricted permissions.  They support API keys
	//and provisioning and tasks like alarms and reports.
	// Issues in this migration: is_service_account should be nullable
	mg.AddMigration("Add is_service_account column to user", NewAddColumnMigration(userV2, &Column{
		Name: "is_service_account", Type: DB_Bool, Nullable: false, Default: "0",
	}))

	mg.AddMigration("Update is_service_account column to nullable",
		NewRawSQLMigration("").
			SQLite(migSQLITEisServiceAccountNullable).
			Postgres("ALTER TABLE `user` ALTER COLUMN is_service_account DROP NOT NULL;").
			Mysql("ALTER TABLE user MODIFY is_service_account BOOLEAN DEFAULT 0;"))

	mg.AddMigration("Add uid column to user", NewAddColumnMigration(userV2, &Column{
		Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: true,
	}))

	mg.AddMigration("Update uid column values for users", NewRawSQLMigration("").
		SQLite("UPDATE user SET uid=printf('u%09d',id) WHERE uid IS NULL;").
		Postgres("UPDATE `user` SET uid='u' || lpad('' || id::text,9,'0') WHERE uid IS NULL;").
		Mysql("UPDATE user SET uid=concat('u',lpad(id,9,'0')) WHERE uid IS NULL;"))

	mg.AddMigration("Add unique index user_uid", NewAddIndexMigration(userV2, &Index{
		Cols: []string{"uid"}, Type: UniqueIndex,
	}))

	// Modifies the user table to add a new column is_provisioned to indicate if the user is provisioned
	// by SCIM or not.
	mg.AddMigration("Add is_provisioned column to user", NewAddColumnMigration(userV2, &Column{
		Name: "is_provisioned", Type: DB_Bool, Nullable: false, Default: "0",
	}))

	// Service accounts login were not unique per org. this migration is part of making it unique per org
	// to be able to create service accounts that are unique per org
	mg.AddMigration(usermig.AllowSameLoginCrossOrgs, &usermig.ServiceAccountsSameLoginCrossOrgs{})
	// Before it was fixed, the previous migration introduced the org_id again in logins that already had it.
	// This migration removes the duplicate org_id from the login.
	mg.AddMigration(usermig.DedupOrgInLogin, &usermig.ServiceAccountsDeduplicateOrgInLogin{})

	// Users login and email should be in lower case
	mg.AddMigration(usermig.LowerCaseUserLoginAndEmail, &usermig.UsersLowerCaseLoginAndEmail{})
	// Users login and email should be in lower case - 2, fix for creating users not lowering login and email
	mg.AddMigration(usermig.LowerCaseUserLoginAndEmail+"2", &usermig.UsersLowerCaseLoginAndEmail{})
}

const migSQLITEisServiceAccountNullable = `ALTER TABLE user ADD COLUMN tmp_service_account BOOLEAN DEFAULT 0;
UPDATE user SET tmp_service_account = is_service_account;
ALTER TABLE user DROP COLUMN is_service_account;
ALTER TABLE user RENAME COLUMN tmp_service_account TO is_service_account;`

type AddMissingUserSaltAndRandsMigration struct {
	MigrationBase
}

func (m *AddMissingUserSaltAndRandsMigration) SQL(dialect Dialect) string {
	return "code migration"
}

type TempUserDTO struct {
	Id    int64
	Login string
}

func (m *AddMissingUserSaltAndRandsMigration) Exec(sess *xorm.Session, mg *Migrator) error {
	users := make([]*TempUserDTO, 0)

	err := sess.SQL(fmt.Sprintf("SELECT id, login from %s WHERE rands = ''", mg.Dialect.Quote("user"))).Find(&users)
	if err != nil {
		return err
	}

	for _, user := range users {
		salt, err := util.GetRandomString(10)
		if err != nil {
			return err
		}
		rands, err := util.GetRandomString(10)
		if err != nil {
			return err
		}
		if _, err := sess.Exec("UPDATE "+mg.Dialect.Quote("user")+
			" SET salt = ?, rands = ? WHERE id = ?", salt, rands, user.Id); err != nil {
			return err
		}
	}
	return nil
}
