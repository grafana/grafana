package variables

// Data source variables allow you to quickly change the data source for an
// entire dashboard.
#Datasource: _variable & {
	// Data source type.
	query: string
	// Query value.
	queryValue: string | *""
	// Refresh.
	refresh: int | *1
	// Regex filter for which data source instances to choose
	// from in the variable value dropdown. Leave empty for
	// all.
	regex: string
	// Variable type.
	type: string | *"datasource"
}
