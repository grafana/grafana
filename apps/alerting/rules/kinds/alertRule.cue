package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
)

alertRuleKind: {
	kind:       "AlertRule"
	pluralName: "AlertRules"
}

alertRulev0alpha1: alertRuleKind & {
	schema: {
		spec: v0alpha1.AlertRuleSpec
	}
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	mutation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	selectableFields: [
		"spec.title",
		"spec.paused",
		"spec.panelRef.dashboardUID",
		"spec.panelRef.panelID",
		"spec.notificationSettings.type",
		"spec.notificationSettings.receiver",
		"spec.notificationSettings.routingTree",
		// TODO: add status fields for filtering
	]

}
