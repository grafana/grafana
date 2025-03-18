package ualert

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// AddAlertRuleVersionUIDIndex adds an index to the alert_rule_version table on (rule_org_id, rule_uid) columns.
func AddAlertRuleVersionUIDIndex(mg *migrator.Migrator) {
	mg.AddMigration("add index to alert_rule_version table on (rule_org_id, rule_uid)",
		migrator.NewAddIndexMigration(
			migrator.Table{Name: "alert_rule_version"},
			&migrator.Index{Cols: []string{"rule_org_id", "rule_uid"}, Type: migrator.IndexType},
		),
	)
}
