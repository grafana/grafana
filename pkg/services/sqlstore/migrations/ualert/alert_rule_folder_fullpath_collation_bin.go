package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// CollateBinAlertRuleFolderFullpath ensures that folder_fullpath column collates in
// the same way go sorts strings, matching CollateBinAlertRuleGroup and
// CollateBinAlertRuleNamespace.
func CollateBinAlertRuleFolderFullpath(mg *migrator.Migrator) {
	mg.AddMigration("ensure folder_fullpath column sorts the same way as golang", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE alert_rule MODIFY folder_fullpath VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL;").
		Postgres(`ALTER TABLE alert_rule ALTER COLUMN folder_fullpath SET DATA TYPE varchar(512) COLLATE "C";`))
}
