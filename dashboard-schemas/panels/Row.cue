package panels

// A row is a logical divider within a dashboard. It is used
// to group panels together.
#Row: {
	// Whether the row is collapsed or not.
	collapsed: bool | *true
	// Name of default data source.
	datasource?: string
	// Grid position.
	gridPos?: _gridPos
	// Dashboard panels.
	panels?: [...{}]
	// Name of template variable to repeat for.
	repeat?: string
	// Whether to display the title.
	showTitle: bool | *true
	// Title.
	title?: string
	// Size of title.
	titleSize: string | *"h6"
	// Panel type.
	type: string | *"row"
}
