package kindsys

// Canonically defined in pkg/kindsys/dataquery.cue FOR NOW to avoid having any external imports
// in kindsys. Code generation copies this file to the common schemas in packages/grafana-schema/src/common.
//
// NOTE make gen-cue must be run twice when updating this file

// These are the common properties available to all queries in all datasources.
// Specific implementations will *extend* this interface, adding the required
// properties for the given context.
DataQuery: {
	// A unique identifier for the query within the list of targets.  
	// In server side expressions, the refId is used as a variable name to identify results.
	// By default, the UI will assign A->Z; however setting meaningful names may be useful.
	refId: string

	// true if query is disabled (ie should not be returned to the dashboard)
	// Note this does not always imply that the query should not be executed since
	// the results from a hidden query may be used as the input to other queries (SSE etc)
	hide?: bool

	// Specify the query flavor
	// TODO make this required and give it a default
	queryType?: string

    // For mixed data sources the selected datasource is on the query level.
    // For non mixed scenarios this is undefined.
	// TODO find a better way to do this ^ that's friendly to schema
	// TODO this shouldn't be unknown but DataSourceRef | null
	datasource?: _
} @cuetsy(kind="interface")

DataSourceRef: {
	// The plugin type-id
	type?: string
	// Specific datasource instance
	uid?: string
} @cuetsy(kind="interface")
