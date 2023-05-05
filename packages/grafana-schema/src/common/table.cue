package common

// Internally, this is the "type" of cell that's being displayed
// in the table such as colored text, JSON, gauge, etc.
// The color-background-solid, gradient-gauge, and lcd-gauge
// modes are deprecated in favor of new cell subOptions
TableCellDisplayMode: "auto" | "color-text" | "color-background" | "color-background-solid" | "gradient-gauge" | "lcd-gauge" | "json-view" | "basic" | "image" | "gauge" | "sparkline" @cuetsy(kind="enum",memberNames="Auto|ColorText|ColorBackground|ColorBackgroundSolid|GradientGauge|LcdGauge|JSONView|BasicGauge|Image|Gauge|Sparkline")

// Display mode to the "Colored Background" display
// mode for table cells. Either displays a solid color (basic mode)
// or a gradient.
TableCellBackgroundDisplayMode: "basic" | "gradient" @cuetsy(kind="enum",memberNames="Basic|Gradient")

// Sort by field state
TableSortByFieldState: {
	// Sets the display name of the field to sort by
	displayName: string
	// Flag used to indicate descending sort order
	desc?:       bool
} @cuetsy(kind="interface")

// Footer options
TableFooterOptions: {
	show: bool
  reducer: [...string] // actually 1 value
  fields?: [...string]
  enablePagination?: bool
  countRows?: bool
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
	valueDisplayMode?: BarGaugeValueMode
} @cuetsy(kind="interface")

// Sparkline cell options
TableSparklineCellOptions: {
	GraphFieldConfig
	type: TableCellDisplayMode & "sparkline"
} @cuetsy(kind="interface")

// Colored background cell options
TableColoredBackgroundCellOptions: {
	type: TableCellDisplayMode & "color-background"
	mode?: TableCellBackgroundDisplayMode
} @cuetsy(kind="interface")

// Height of a table cell
TableCellHeight: "sm" | "md" | "lg" @cuetsy(kind="enum")

// Table cell options. Each cell has a display mode
// and other potential options for that display.
TableCellOptions: TableAutoCellOptions | TableSparklineCellOptions | TableBarGaugeCellOptions | TableColoredBackgroundCellOptions | TableColorTextCellOptions | TableImageCellOptions | TableJsonViewCellOptions @cuetsy(kind="type")

// Field options for each field within a table (e.g 10, "The String", 64.20, etc.)
// Generally defines alignment, filtering capabilties, display options, etc.
TableFieldOptions: {
	width?:      number
	minWidth?:   number
	align: FieldTextAlignment & (*"auto" | _)
	// This field is deprecated in favor of using cellOptions
	displayMode?: TableCellDisplayMode
	cellOptions: TableCellOptions
	hidden?:     bool // ?? default is missing or false ??
	inspect: bool | *false
	filterable?: bool
} @cuetsy(kind="interface")

