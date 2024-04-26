package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddRecordingRuleColumns adds columns to alert_rule to represent recording rules.
func AddRecordingRuleColumns(mg *migrator.Migrator) {
	mg.AddMigration("add record column to alert_rule table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule"}, &migrator.Column{
		Name:     "record",
		Type:     migrator.DB_NVarchar,
		Length:   DefaultFieldMaxLength,
		Default:  "''",
		Nullable: false,
	}))

	mg.AddMigration("add record column to alert_rule_version table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule_version"}, &migrator.Column{
		Name:     "record",
		Type:     migrator.DB_NVarchar,
		Length:   DefaultFieldMaxLength,
		Default:  "''",
		Nullable: false,
	}))

	mg.AddMigration("add record_from column to alert_rule table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule"}, &migrator.Column{
		Name:     "record_from",
		Type:     migrator.DB_NVarchar,
		Length:   DefaultFieldMaxLength,
		Default:  "''",
		Nullable: false,
	}))

	mg.AddMigration("add record_from column to alert_rule_version table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule_version"}, &migrator.Column{
		Name:     "record_from",
		Type:     migrator.DB_NVarchar,
		Length:   DefaultFieldMaxLength,
		Default:  "''",
		Nullable: false,
	}))
}
