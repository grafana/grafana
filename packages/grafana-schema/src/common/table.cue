package common

// Internally, this is the "type" of cell that's being displayed
// in the table such as colored text, JSON, gauge, etc.
// The color-background-solid, gradient-gauge, and lcd-gauge
// modes are deprecated in favor of new cell subOptions
TableCellDisplayMode: "auto" | "color-text" | "color-background" | "color-background-solid" | "gradient-gauge" | "lcd-gauge" | "json-view" | "basic" | "image" | "gauge" | "sparkline" | "data-links" | "custom" | "actions" | "pill" | "markdown" @cuetsy(kind="enum",memberNames="Auto|ColorText|ColorBackground|ColorBackgroundSolid|GradientGauge|LcdGauge|JSONView|BasicGauge|Image|Gauge|Sparkline|DataLinks|Custom|Actions|Pill|Markdown")

// Display mode to the "Colored Background" display
// mode for table cells. Either displays a solid color (basic mode)
// or a gradient.
TableCellBackgroundDisplayMode: "basic" | "gradient" @cuetsy(kind="enum",memberNames="Basic|Gradient")

// Whenever we add text wrapping, we should add all text wrapping options at once
TableWrapTextOptions: {
  // if true, wrap the text content of the cell
  wrapText?: bool
} @cuetsy(kind="interface")

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
} & TableWrapTextOptions @cuetsy(kind="interface")

// Colored text cell options
TableColorTextCellOptions: {
	type: TableCellDisplayMode & "color-text"
} & TableWrapTextOptions @cuetsy(kind="interface")

// Json view cell options
TableJsonViewCellOptions: {
	type: TableCellDisplayMode & "json-view"
} @cuetsy(kind="interface")

// Json view cell options
TableImageCellOptions: {
	type: TableCellDisplayMode & "image"
	alt?: string
	title?: string
} @cuetsy(kind="interface")

// Show data links in the cell
TableDataLinksCellOptions: {
	type: TableCellDisplayMode & "data-links"
} & TableWrapTextOptions @cuetsy(kind="interface")

// Show actions in the cell
TableActionsCellOptions: {
	type: TableCellDisplayMode & "actions"
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
  hideValue?: bool
} @cuetsy(kind="interface")

// Colored background cell options
TableColoredBackgroundCellOptions: {
	type: TableCellDisplayMode & "color-background"
	mode?: TableCellBackgroundDisplayMode
	applyToRow?: bool
} & TableWrapTextOptions @cuetsy(kind="interface")

TablePillCellOptions: {
  type: TableCellDisplayMode & "pill"
} & TableWrapTextOptions @cuetsy(kind="interface")

TableMarkdownCellOptions: {
	type: TableCellDisplayMode & "markdown"
} @cuetsy(kind="interface")

// Height of a table cell
TableCellHeight: "sm" | "md" | "lg" @cuetsy(kind="enum")

// Table cell options. Each cell has a display mode
// and other potential options for that display.
TableCellOptions: TableAutoCellOptions | TableSparklineCellOptions | TableBarGaugeCellOptions | TableColoredBackgroundCellOptions | TableColorTextCellOptions | TableImageCellOptions | TablePillCellOptions | TableDataLinksCellOptions | TableActionsCellOptions | TableJsonViewCellOptions | TableMarkdownCellOptions @cuetsy(kind="type")

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
	// Hides any header for a column, useful for columns that show some static content or buttons.
	hideHeader?: bool
  // Enables text wrapping for column headers
  wrapHeaderText?: bool
  // If true, virtualization is disabled and height is set to auto
  disableVirtualization?: bool
} @cuetsy(kind="interface")
