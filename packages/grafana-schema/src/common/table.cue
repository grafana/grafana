package common

// Internally, this is the "type" of cell that's being displayed
// in the table such as colored text, JSON, gauge, etc.
// The color-background-solid, gradient-gauge, and lcd-gauge
// modes are deprecated in favor of new cell subOptions
TableCellDisplayMode: "auto" | "color-text" | "color-background" | "color-background-solid" | "gradient-gauge" | "lcd-gauge" | "json-view" | "basic" | "image" | "gauge" @cuetsy(kind="enum",memberNames="Auto|ColorText|ColorBackground|ColorBackgroundSolid|GradientGauge|LcdGauge|JSONView|BasicGauge|Image|Gauge")

// Display mode to the "Colored Background" display
// mode for table cells. Either displays a solid color (basic mode)
// or a gradient.
TableCellBackgroundDisplayMode: "basic" | "gradient" @cuetsy(kind="enum",memberNames="Basic|Gradient")

// TODO docs
TableSortByFieldState: {
	displayName: string
	desc?:       bool
} @cuetsy(kind="interface")

// Auto mode table cell options
TableAutoCellOptions: {
	type: TableCellDisplayMode & "auto"
} @cuetsy(kind="interface")

// Colored text cell options
TableColorTextCellOptions: {
	type: TableCellDisplayMode & "color-text"
} @cuetsy(kind="interface")

// Json view cell options
TableJsonViewCellOptions: {
	type: TableCellDisplayMode & "json-view"
} @cuetsy(kind="interface")

// Json view cell options
TableImageCellOptions: {
	type: TableCellDisplayMode & "image"
} @cuetsy(kind="interface")

// Gauge cell options
TableBarGaugeCellOptions: {
	type: TableCellDisplayMode & "gauge"
	mode?: BarGaugeDisplayMode
} @cuetsy(kind="interface")

// Colored background cell options
TableColoredBackgroundCellOptions: {
	type: TableCellDisplayMode & "color-background"
	mode?: TableCellBackgroundDisplayMode
} @cuetsy(kind="interface")

// Table cell options. Each cell has a display mode
// and other potential options for that display.
TableCellOptions: TableAutoCellOptions | TableBarGaugeCellOptions | TableColoredBackgroundCellOptions | TableColorTextCellOptions | TableImageCellOptions | TableJsonViewCellOptions @cuetsy(kind="type")

// Field options for each field within a table (e.g 10, "The String", 64.20, etc.)
// Generally defines alignment, filtering capabilties, display options, etc.
TableFieldOptions: {
	width?:      number
	minWidth?:   number
	align: FieldTextAlignment | *"auto"
	// This field is deprecated in favor of using cellOptions
	displayMode?: TableCellDisplayMode
	cellOptions: TableCellOptions
	hidden?:     bool // ?? default is missing or false ??
	inspect: bool | *false
	filterable?: bool
} @cuetsy(kind="interface")

