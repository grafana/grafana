package kinds

import (
	"github.com/grafana/grafana/apps/logsdrilldown/kinds/v0alpha1"
)

LogsDrilldownSpecv0alpha1: {
	defaultFields: [...string] | *[]
	prettifyJSON: bool
	wrapLogMessage: bool
	interceptDismissed: bool
}

// Users
logsdrilldownv0alpha1: {
	kind:       "LogsDrilldown"  // note: must be uppercase
	schema: {
		spec: LogsDrilldownSpecv0alpha1
	}
}

logsdrilldownDefaultColumnsv0alpha1: {
	kind: "LogsDrilldownDefaultColumns"
	pluralName: "LogsDrilldownDefaultColumns"
	schema: {
		spec: v0alpha1.LogsDefaultColumns
	}
}

// Admins
logsdrilldownDefaultsv0alpha1: {
	kind:       "LogsDrilldownDefaults"  // note: must be uppercase
	pluralName: "LogsDrilldownDefaults"
	schema: {
		spec: LogsDrilldownSpecv0alpha1
	}
}
