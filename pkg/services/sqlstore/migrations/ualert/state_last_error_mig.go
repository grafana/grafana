package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddStateLastErrorColumn adds a last_error column to alert_instance.
func AddStateLastErrorColumn(mg *migrator.Migrator) {
	mg.AddMigration("add last_error column to alert_instance table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_instance"}, &migrator.Column{
		Name:     "last_error",
		Type:     migrator.DB_Text,
		Nullable: true,
	}))
}
