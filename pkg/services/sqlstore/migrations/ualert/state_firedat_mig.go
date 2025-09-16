package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddStateFiredAtColumn adds a fired_at column to alert_instance to represent FiredAt.
func AddStateFiredAtColumn(mg *migrator.Migrator) {
	mg.AddMigration("add fired_at column to alert_instance table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_instance"}, &migrator.Column{
		Name:     "fired_at",
		Type:     migrator.DB_BigInt, // BigInt, to match existing time fields.
		Nullable: true,
	}))
}
