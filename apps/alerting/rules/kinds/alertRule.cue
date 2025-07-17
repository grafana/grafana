package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
)

alertRule: {
	kind: "AlertRule"
	apiResource: {
		groupOverride: "rules.alerting.grafana.app"
	}
	pluralName: "AlertRules"
	current:    "v0alpha1"
	codegen: {
		ts: {enabled: true}
		go: {enabled: true}
	}
	versions: {
		"v0alpha1": {
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
	}
}
