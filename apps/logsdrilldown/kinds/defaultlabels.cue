package kinds

import (
	"github.com/grafana/grafana/apps/logsdrilldown/kinds/v1beta1"
)

// Default columns API (alpha)
logsdrilldownDefaultLabelsv1beta1: {
	kind:       "LogsDrilldownDefaultLabels"
	pluralName: "LogsDrilldownDefaultLabels"
	// Access is decided by the router's hardcoded Logs Drilldown rules
	// (pluginroute hardcoded_kinds.go), not by a folder.
	folderScoped: false
	schema: {
		spec: v1beta1.LogsDefaultLabels
	}
}
