package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

timeIntervalv0alpha1: {
	kind:   "TimeInterval"
	plural: "timeintervals"
	scope:  "Namespaced"
	schema: {
		spec: v0alpha1.TimeIntervalSpec
	}
	selectableFields: [
		"spec.name",
	]
}
