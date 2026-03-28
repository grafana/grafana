package ualert

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// AddRuleAlertRoutingColumns creates a column for alert routing settings in the alert_rule and alert_rule_version tables.
func AddRuleAlertRoutingColumns(mg *migrator.Migrator) {
	mg.AddMigration("add alert_routing column to alert_rule table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule"}, &migrator.Column{
		Name:     "alert_routing_policy",
		Type:     migrator.DB_NVarchar,
		Length:   UIDMaxLength,
		Nullable: true,
	}))

	mg.AddMigration("add alert_routing column to alert_rule_version table", migrator.NewAddColumnMigration(migrator.Table{Name: "alert_rule_version"}, &migrator.Column{
		Name:     "alert_routing_policy",
		Type:     migrator.DB_NVarchar,
		Length:   UIDMaxLength,
		Nullable: true,
	}))
}
