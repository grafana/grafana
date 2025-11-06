package kinds

logsdrilldownv0alpha1: {
	kind:       "LogsDrilldown"  // note: must be uppercase
	schema: {
		spec: {
			defaultFields: [...string] | *[]
			prettifyJSON: bool
			wrapLogMessage: bool
			interceptDismissed: bool
		}
	}
}
