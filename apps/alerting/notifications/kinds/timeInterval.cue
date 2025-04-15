package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

timeInterval: {
	kind: "TimeInterval"
	apiResource: {
		groupOverride: "notifications.alerting.grafana.app"
	}
	codegen: {
		frontend: false
		backend:  true
	}
	pluralName: "TimeIntervals"
	current:    "v0alpha1"
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
