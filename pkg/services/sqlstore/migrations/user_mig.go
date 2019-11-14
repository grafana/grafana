package migrations

import (
	"fmt"

	"github.com/go-xorm/xorm"
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
}

type AddMissingUserSaltAndRandsMigration struct {
	MigrationBase
}

func (m *AddMissingUserSaltAndRandsMigration) Sql(dialect Dialect) string {
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
