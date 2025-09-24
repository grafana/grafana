package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)
timeIntervalKind: {
	kind: "TimeInterval"
	pluralName: "TimeIntervals"
}

timeIntervalv0alpha1: timeIntervalKind & {
	schema: {
		spec: v0alpha1.TimeIntervalSpec
	}
//	selectableFields: [ // TODO revisit when custom field selectors are supported
//		"spec.name",
//	]
}