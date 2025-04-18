package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

timeInterval: {
	kind: "TimeInterval"
	apiResource: {
		groupOverride: "notifications.alerting.grafana.app"
	}
	pluralName: "TimeIntervals"
	current:    "v0alpha1"
	codegen: {
		ts: {enabled: false}
		go: {enabled: true}
	}
	versions: {
		"v0alpha1": {
			schema: {
				spec: v0alpha1.TimeIntervalSpec
			}
			selectableFields: [
				"spec.name",
			]
		}
	}
}
