package kinds

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
