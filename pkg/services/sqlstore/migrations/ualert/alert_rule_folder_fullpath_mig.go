package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddAlertRuleFolderFullpath adds folder_fullpath column to alert_rule table.
func AddAlertRuleFolderFullpath(mg *migrator.Migrator) {
	column := &migrator.Column{
		Name:     "folder_fullpath",
		Type:     migrator.DB_NVarchar,
		Length:   1024, // Should accommodate deep folder hierarchies
		Nullable: true, // Nullable for backward compatibility
	}

	mg.AddMigration(
		"add folder_fullpath column to alert_rule",
		migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule"}, column),
	)

	// Add index for efficient sorting
	mg.AddMigration(
		"add index on folder_fullpath in alert_rule",
		migrator.NewAddIndexMigration(
			migrator.Table{Name: "alert_rule"},
			&migrator.Index{
				Cols: []string{"org_id", "folder_fullpath"},
				Type: migrator.IndexType,
			},
		),
	)
}
