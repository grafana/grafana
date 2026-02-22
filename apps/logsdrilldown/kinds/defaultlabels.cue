package kinds

import (
	"github.com/grafana/grafana/apps/logsdrilldown/kinds/v1beta1",
)

// Default columns API (alpha)
logsdrilldownDefaultLabelsv1beta1: {
	kind: "LogsDrilldownDefaultLabels"
	pluralName: "LogsDrilldownDefaultLabels"
	schema: {
		spec: v1beta1.LogsDefaultLabels
	}
}
