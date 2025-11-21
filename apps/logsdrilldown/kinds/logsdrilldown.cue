package kinds

#LogsDefaultColumns: {
		datasource: [...{
			dsUID: string
			records: [...{
				columns: [...string],
				labels: [...{
					key: string,
					value: string
				}]
			}]
		}]
	}

LogsDrilldownSpecv0alpha1: {
	defaultFields: [...string] | *[]
	prettifyJSON: bool
	wrapLogMessage: bool
	interceptDismissed: bool
	defaultColumns: #LogsDefaultColumns
}

// Users
logsdrilldownv0alpha1: {
	kind:       "LogsDrilldown"  // note: must be uppercase
	schema: {
		spec: LogsDrilldownSpecv0alpha1
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
