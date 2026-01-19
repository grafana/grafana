package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddStateLastResultColumn adds a last_result column to alert_instance.
func AddStateLastResultColumn(mg *migrator.Migrator) {
	mg.AddMigration("add last_result column to alert_instance table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_instance"}, &migrator.Column{
		Name:     "last_result",
		Type:     migrator.DB_Text,
		Nullable: true,
	}))
}
