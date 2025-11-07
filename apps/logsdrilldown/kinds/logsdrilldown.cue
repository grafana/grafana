package kinds

LogsDrilldownSpecv0alpha1: {
	defaultFields: [...string] | *[]
	prettifyJSON: bool
	wrapLogMessage: bool
	interceptDismissed: bool
}

logsdrilldownv0alpha1: {
	kind:       "LogsDrilldown"  // note: must be uppercase
	schema: {
		spec: LogsDrilldownSpecv0alpha1
	}
}

logsdrilldownDefaultsv0alpha1: {
	kind:       "LogsDrilldownDefaults"  // note: must be uppercase
	pluralName: "LogsDrilldownDefaults"
	schema: {
		spec: LogsDrilldownSpecv0alpha1
	}
}
