package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// CollateAlertRuleGroup ensures that rule_group column uses a case-sensitive collation.
// Originally used utf8mb4_0900_as_cs, but that collation is not supported by MariaDB (see #118836).
// Changed to utf8mb4_bin for compatibility. This is superseded by CollateBinAlertRuleGroup which
// also sets utf8mb4_bin, but we keep this migration (rather than removing it) to avoid leaving
// orphan entries in the migration_log table for users who already ran it successfully.
func CollateAlertRuleGroup(mg *migrator.Migrator) {
	mg.AddMigration("ensure rule_group column is case sensitive in returned results", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE alert_rule MODIFY rule_group VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;"))
}
