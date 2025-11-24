package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// CollateBinAlertRuleGroup ensures that rule_group column collates in the same way go sorts strings.
func CollateBinAlertRuleGroup(mg *migrator.Migrator) {
	mg.AddMigration("ensure rule_group column sorts the same way as golang", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE alert_rule MODIFY rule_group VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;").
		Postgres(`ALTER TABLE alert_rule ALTER COLUMN rule_group SET DATA TYPE varchar(190) COLLATE "C";`))
}
