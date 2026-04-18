package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddStateAnnotationsColumn adds annotations column to alert_instance
func AddStateAnnotationsColumn(mg *migrator.Migrator) {
	mg.AddMigration("add annotations column to alert_instance table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_instance"}, &migrator.Column{
		Name:     "annotations",
		Type:     migrator.DB_Text,
		Nullable: true,
	}))
}
