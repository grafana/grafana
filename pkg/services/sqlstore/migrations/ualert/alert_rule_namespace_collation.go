package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// CollateBinAlertRuleNamespace ensures that namespace_uid column collates in the same way go sorts strings.
func CollateBinAlertRuleNamespace(mg *migrator.Migrator) {
	mg.AddMigration("ensure namespace_uid column sorts the same way as golang", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE alert_rule MODIFY namespace_uid VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;").
		Postgres(`ALTER TABLE alert_rule ALTER COLUMN namespace_uid SET DATA TYPE varchar(40) COLLATE "C";`))
}
