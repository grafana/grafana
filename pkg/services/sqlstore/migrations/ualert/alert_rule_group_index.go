package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddAlertRuleGroupIndexMigration adds an index on org_id, namespace_uid, rule_group, and rule_group_idx columns to alert_rule table.
func AddAlertRuleGroupIndexMigration(mg *migrator.Migrator) {
	mg.AddMigration("add index in alert_rule on org_id, namespace_uid, rule_group and rule_group_idx columns", migrator.NewAddIndexMigration(
		migrator.Table{Name: "alert_rule"},
		&migrator.Index{
			Name: "IDX_alert_rule_org_id_namespace_uid_rule_group_rule_group_idx",
			Cols: []string{"org_id", "namespace_uid", "rule_group", "rule_group_idx"},
		},
	))
}
