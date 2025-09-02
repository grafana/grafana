package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
)

alertRuleKind: {
	kind: "AlertRule"
	apiResource: {
		groupOverride: "rules.alerting.grafana.app"
	}
	pluralName: "AlertRules"
}

alertRulev0alpha1: alertRuleKind & {
	schema: {
		spec: v0alpha1.AlertRuleSpec
	}
	selectableFields: [
		"spec.title",
		"spec.paused",
		"spec.panelRef.dashboardUID",
		"spec.panelRef.panelID",
		"spec.notificationSettings.receiver",
		// TODO: add status fields for filtering
	]

}
