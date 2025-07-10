package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

templateGroup: {
	kind: "TemplateGroup"
	apiResource: {
		groupOverride: "notifications.alerting.grafana.app"
	}
	pluralName: "TemplateGroups"
	current:    "v0alpha1"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			schema: {
				spec: v0alpha1.TemplateGroupSpec
			}
			selectableFields: [
				"spec.title",
			]
		}
	}
}
