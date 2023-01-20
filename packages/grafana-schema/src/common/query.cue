package common

DataQuery: {
		// A - Z
		refId: string
		// true if query is disabled (ie should not be returned to the dashboard)
		hide?: bool
		//Unique, guid like, string used in explore mode
		key?: string
		// Specify the query flavor
		queryType?: string

		// For mixed data sources the selected datasource is on the query level.
		// For non mixed scenarios this is undefined.
		datasource?: #DataSourceRef // TODO add | null
} @cuetsy(kind="interface")

// Ref to a DataSource instance
// TODO Fix, duplicate type
#DataSourceRef: {
	// The plugin type-id
	type?: string @grafanamaturity(NeedsExpertReview)

	// Specific datasource instance
	uid?: string @grafanamaturity(NeedsExpertReview)
} @cuetsy(kind="interface") @grafanamaturity(NeedsExpertReview)
