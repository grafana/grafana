package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// CollateAlertRuleGroup ensures that rule_group column collates.
func CollateAlertRuleGroup(mg *migrator.Migrator) {
	mg.AddMigration("ensure rule_group column is case sensitive in returned results", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE alert_rule MODIFY rule_group VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL;"))
}
