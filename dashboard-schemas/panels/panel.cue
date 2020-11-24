package panels

panel: {
	// Panel title.
	title?: string
	// Description.
	description?: string
	// Whether to display the panel without a background.
	transparent: bool | *false
	// Name of default datasource.
	datasource?: string
	// Grid position.
	gridPos?: gridPos
	// Panel links.
	links?: [...panelLink]
	// Name of template variable to repeat for.
	repeat?: string
	// Direction to repeat in if 'repeat' is set.
	// "h" for horizontal, "v" for vertical.
	repeatDirection: *"h" | "v"
	// Panel targets - datasource and query configurations to use as
	// a basis for vizualization.
	targets?: [...{}]
}
