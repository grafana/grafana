package migrations

import (
	"time"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"xorm.io/xorm"
)

func addTempUserMigrations(mg *Migrator) {
	tempUserV1 := Table{
		Name: "temp_user",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "email", Type: DB_NVarchar, Length: 190},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "role", Type: DB_NVarchar, Length: 20, Nullable: true},
			{Name: "code", Type: DB_NVarchar, Length: 190},
			{Name: "status", Type: DB_Varchar, Length: 20},
			{Name: "invited_by_user_id", Type: DB_BigInt, Nullable: true},
			{Name: "email_sent", Type: DB_Bool},
			{Name: "email_sent_on", Type: DB_DateTime, Nullable: true},
			{Name: "remote_addr", Type: DB_Varchar, Length: 255, Nullable: true},
			{Name: "created", Type: DB_DateTime},
			{Name: "updated", Type: DB_DateTime},
		},
		Indices: []*Index{
			{Cols: []string{"email"}, Type: IndexType},
			{Cols: []string{"org_id"}, Type: IndexType},
			{Cols: []string{"code"}, Type: IndexType},
			{Cols: []string{"status"}, Type: IndexType},
		},
	}

	// addDropAllIndicesMigrations(mg, "v7", tempUserV1)
	// mg.AddMigration("Drop old table tempUser v7", NewDropTableMigration("temp_user"))

	// create table
	mg.AddMigration("create temp user table v1-7", NewAddTableMigration(tempUserV1))
	addTableIndicesMigrations(mg, "v1-7", tempUserV1)

	mg.AddMigration("Update temp_user table charset", NewTableCharsetMigration("temp_user", []*Column{
		{Name: "email", Type: DB_NVarchar, Length: 190},
		{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "role", Type: DB_NVarchar, Length: 20, Nullable: true},
		{Name: "code", Type: DB_NVarchar, Length: 190},
		{Name: "status", Type: DB_Varchar, Length: 20},
		{Name: "remote_addr", Type: DB_Varchar, Length: 255, Nullable: true},
	}))

	tempUserV2 := Table{
		Name: "temp_user",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "email", Type: DB_NVarchar, Length: 190},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "role", Type: DB_NVarchar, Length: 20, Nullable: true},
			{Name: "code", Type: DB_NVarchar, Length: 190},
			{Name: "status", Type: DB_Varchar, Length: 20},
			{Name: "invited_by_user_id", Type: DB_BigInt, Nullable: true},
			{Name: "email_sent", Type: DB_Bool},
			{Name: "email_sent_on", Type: DB_DateTime, Nullable: true},
			{Name: "remote_addr", Type: DB_Varchar, Length: 255, Nullable: true},
			{Name: "created", Type: DB_Int, Default: "0", Nullable: false},
			{Name: "updated", Type: DB_Int, Default: "0", Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"email"}, Type: IndexType},
			{Cols: []string{"org_id"}, Type: IndexType},
			{Cols: []string{"code"}, Type: IndexType},
			{Cols: []string{"status"}, Type: IndexType},
		},
	}

	addTableReplaceMigrations(mg, tempUserV1, tempUserV2, 2, map[string]string{
		"id":                 "id",
		"org_id":             "org_id",
		"version":            "version",
		"email":              "email",
		"name":               "name",
		"role":               "role",
		"code":               "code",
		"status":             "status",
		"invited_by_user_id": "invited_by_user_id",
		"email_sent":         "email_sent",
		"email_sent_on":      "email_sent_on",
		"remote_addr":        "remote_addr",
	})

	// Ensure outstanding invites are given a valid lifetime post-migration
	mg.AddMigration("Set created for temp users that will otherwise prematurely expire", &SetCreatedForOutstandingInvites{})
}

type SetCreatedForOutstandingInvites struct {
	MigrationBase
}

func (m *SetCreatedForOutstandingInvites) Sql(dialect Dialect) string {
	return "code migration"
}

func (m *SetCreatedForOutstandingInvites) Exec(sess *xorm.Session, mg *Migrator) error {
	created := time.Now().Unix()
	if _, err := sess.Exec("UPDATE "+mg.Dialect.Quote("temp_user")+
		" SET created = ?, updated = ? WHERE created = '0' AND status in ('SignUpStarted', 'InvitePending')", created, created); err != nil {
		return err
	}
	return nil
}
