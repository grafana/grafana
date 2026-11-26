package kinds

import (
	"github.com/grafana/grafana/apps/logsdrilldown/kinds/v1beta1"
)

LogsDrilldownSpecv1alpha1: {
	defaultFields: [...string] | *[]
	prettifyJSON:       bool
	wrapLogMessage:     bool
	interceptDismissed: bool
}

logsdrilldownv1alpha1: {
	kind: "LogsDrilldown" // note: must be uppercase
	// Access is decided by the router's hardcoded Logs Drilldown rules
	// (pluginroute hardcoded_kinds.go), not by a folder.
	folderScoped: false
	schema: {
		spec: LogsDrilldownSpecv1alpha1
	}
}

logsdrilldownDefaultsv1alpha1: {
	kind:       "LogsDrilldownDefaults" // note: must be uppercase
	pluralName: "LogsDrilldownDefaults"
	// Access is decided by the router's hardcoded Logs Drilldown rules
	// (pluginroute hardcoded_kinds.go), not by a folder.
	folderScoped: false
	schema: {
		spec: LogsDrilldownSpecv1alpha1
	}
}

// Default columns API (beta)
logsdrilldownDefaultColumnsv1beta1: {
	kind:       "LogsDrilldownDefaultColumns"
	pluralName: "LogsDrilldownDefaultColumns"
	// Access is decided by the router's hardcoded Logs Drilldown rules
	// (pluginroute hardcoded_kinds.go), not by a folder.
	folderScoped: false
	schema: {
		spec: v1beta1.LogsDefaultColumns
	}
}
