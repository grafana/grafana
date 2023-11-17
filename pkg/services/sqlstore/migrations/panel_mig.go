package migrations

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addPanelMigrations(mg *migrator.Migrator) {
	mg.AddMigration("create panel table", migrator.NewAddTableMigration(panelv1()))

	// #TODO: figure out if there's a better way
	// #TODO: how to set length when adding the column this way?
	mg.AddMigration("Add column title in panel", migrator.NewRawSQLMigration("").
		SQLite("ALTER TABLE panel ADD title TEXT;").
		Postgres(`ALTER TABLE panel ADD COLUMN title tsvector;`).
		Mysql("ALTER TABLE panel ADD title TEXT;"))

	mg.AddMigration("Add full text column title in panel", migrator.NewRawSQLMigration("").
		Mysql(`ALTER TABLE panel ADD FULLTEXT(title);`))

	mg.AddMigration("Add title index in panel", migrator.NewRawSQLMigration("").
		// #TODO: rename the index
		Mysql(`CREATE INDEX title_index ON panel (title(255));`))
}

func panelv1() migrator.Table {
	// Do not make any changes to this schema; introduce new migrations for further changes
	return migrator.Table{
		Name: "panel",
		Columns: []*migrator.Column{
			// #TODO: decide what identifier to use for the dashboard
			// #TODO: do we have to have a primary key?
			{Name: "dashid", Type: migrator.DB_BigInt},
		},
	}
}
