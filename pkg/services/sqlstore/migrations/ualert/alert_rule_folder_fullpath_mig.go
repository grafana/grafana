package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddAlertRuleFolderFullpath adds folder_fullpath column to alert_rule table.
func AddAlertRuleFolderFullpath(mg *migrator.Migrator) {
	column := &migrator.Column{
		Name:     "folder_fullpath",
		Type:     migrator.DB_NVarchar,
		Length:   512,  // Must fit within MySQL's 3072-byte index key limit (512 * 4 + 8 = 2056 bytes)
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
