package kinds

import (
	"github.com/grafana/grafana/apps/logsdrilldown/kinds/v0alpha1",
	"github.com/grafana/grafana/apps/logsdrilldown/kinds/v1beta1",
)

LogsDrilldownSpecv1alpha1: {
	defaultFields: [...string] | *[]
	prettifyJSON: bool
	wrapLogMessage: bool
	interceptDismissed: bool
}

logsdrilldownv1alpha1: {
	kind:       "LogsDrilldown"  // note: must be uppercase
	schema: {
		spec: LogsDrilldownSpecv1alpha1
	}
}

logsdrilldownDefaultsv1alpha1: {
	kind:       "LogsDrilldownDefaults"  // note: must be uppercase
	pluralName: "LogsDrilldownDefaults"
	schema: {
		spec: LogsDrilldownSpecv1alpha1
	}
}

// Default columns API (alpha)
logsdrilldownDefaultColumnsv0alpha1: {
	kind: "LogsDrilldownDefaultColumns"
	pluralName: "LogsDrilldownDefaultColumns"
	schema: {
		spec: v0alpha1.LogsDefaultColumns
	}
}

// Default columns API (beta)
logsdrilldownDefaultColumnsv1beta1: {
	kind: "LogsDrilldownDefaultColumns"
	pluralName: "LogsDrilldownDefaultColumns"
	schema: {
		spec: v1beta1.LogsDefaultColumns
	}
}
