package migrations

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const DashUIDinPanelTable = "dashboard_uid"
const OrgIDinPanelTable = "org_id"

func addPanelMigrations(mg *migrator.Migrator) {
	mg.AddMigration("Create panel table", migrator.NewRawSQLMigration("").
		SQLite(
			fmt.Sprintf(
				"CREATE TABLE panel (title text, %s int, %s int);",
				DashUIDinPanelTable,
				OrgIDinPanelTable)).
		Mysql(
			fmt.Sprintf(
				"CREATE TABLE panel (title text, %s int, %s int);",
				DashUIDinPanelTable,
				OrgIDinPanelTable)).
		Postgres(
			fmt.Sprintf(
				"CREATE TABLE panel (title tsvector, %s int, %s int);",
				DashUIDinPanelTable,
				OrgIDinPanelTable)))

	mg.AddMigration(
		"Add full text column title in panel", migrator.NewRawSQLMigration("").
			Mysql(`ALTER TABLE panel ADD FULLTEXT(title);`))
}
