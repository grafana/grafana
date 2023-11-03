package migrations

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addPanelMigrations(mg *migrator.Migrator) {
	mg.AddMigration("create panel table", migrator.NewAddTableMigration(panelv1()))
}

func panelv1() migrator.Table {
	// Do not make any changes to this schema; introduce new migrations for further changes
	return migrator.Table{
		Name: "panel",
		Columns: []*migrator.Column{
			// #TODO: decide what identifier to use for the dashboard
			// #TODO: do we have to have a primary key?
			{Name: "dashid", Type: migrator.DB_BigInt},
			{Name: "title", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
		},
	}
}
