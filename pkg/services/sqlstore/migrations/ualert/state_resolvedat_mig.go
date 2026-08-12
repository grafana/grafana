package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddStateResolvedAtColumns adds columns to alert_instance to represent ResolvedAt and LastSentAt.
func AddStateResolvedAtColumns(mg *migrator.Migrator) {
	mg.AddMigration("add resolved_at column to alert_instance table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_instance"}, &migrator.Column{
		Name:     "resolved_at",
		Type:     migrator.DB_BigInt, // BigInt, to match existing time fields.
		Nullable: true,
	}))

	mg.AddMigration("add last_sent_at column to alert_instance table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_instance"}, &migrator.Column{
		Name:     "last_sent_at",
		Type:     migrator.DB_BigInt,
		Nullable: true,
	}))
}
