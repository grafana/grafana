package variables

// Custom variables are for values that do not change.
#Custom: _variable & {
	// Options as comma separated values.
	query: string
	// Variable type.
	type: string | *"custom"
}
