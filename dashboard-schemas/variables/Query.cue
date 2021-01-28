package variables

// Query variables allow you to write a data source query that can return a
// list of metric names, tag values, or keys.
#Query: _variable & {
	// Data source to use.
	datasource: string
	// Definition.
	definition?: string
	// Query.
	query: string
	// Refresh.
	refresh: int | *1
	// Regex.
	regex?: string
	// * 0 - Disabled.
	// * 1 - Alphabetical (asc).
	// * 2 - Alphabetical (desc).
	// * 3 - Numerical (asc).
	// * 4 - Numerical (desc).
	// * 5 - Alphabetical (case-insensitive, asc).
	// * 6 - Alphabetical (case-insensitive, desc).
	sort:            int >= 0 <= 6 | *0
	tagValuesQuery?: string
	tags:            [...string] | *[]
	tagsQuery?:      string
	// Variable type.
	type:    "query"
	useTags: bool | *false
}
