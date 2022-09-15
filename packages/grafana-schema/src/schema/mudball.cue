package schema

// TODO break this up into individual files. Current limitation on this is codegen logic, imports, dependencies

// TODO docs
AxisPlacement:      "auto" | "top" | "right" | "bottom" | "left" | "hidden" @cuetsy(kind="enum")

// TODO docs
AxisColorMode:      "text" | "series"                                       @cuetsy(kind="enum")

// TODO docs
VisibilityMode:     "auto" | "never" | "always"                             @cuetsy(kind="enum")

// TODO docs
GraphDrawStyle:     "line" | "bars" | "points"                              @cuetsy(kind="enum")

// TODO docs
GraphTransform:     "constant" | "negative-Y"                               @cuetsy(kind="enum",memberNames="Constant|NegativeY")

// TODO docs
LineInterpolation:  "linear" | "smooth" | "stepBefore" | "stepAfter"        @cuetsy(kind="enum")

// TODO docs
ScaleDistribution:  "linear" | "log" | "ordinal" | "symlog"                 @cuetsy(kind="enum")

// TODO docs
GraphGradientMode:  "none" | "opacity" | "hue" | "scheme"                   @cuetsy(kind="enum")

// TODO docs
StackingMode:       "none" | "normal" | "percent"                           @cuetsy(kind="enum")

// TODO docs
BarAlignment:       -1 | 0 | 1                                              @cuetsy(kind="enum",memberNames="Before|Center|After")

// TODO docs
ScaleOrientation:   0 | 1                                                   @cuetsy(kind="enum",memberNames="Horizontal|Vertical")

// TODO docs
ScaleDirection:     1 | 1 | -1 | -1                                         @cuetsy(kind="enum",memberNames="Up|Right|Down|Left")

// TODO docs
LineStyle: {
	fill?: "solid" | "dash" | "dot" | "square"
	dash?: [...number]
} @cuetsy(kind="interface")

// TODO docs
LineConfig: {
	lineColor?:         string
	lineWidth?:         number
	lineInterpolation?: LineInterpolation
	lineStyle?:         LineStyle

	// Indicate if null values should be treated as gaps or connected.
	// When the value is a number, it represents the maximum delta in the
	// X axis that should be considered connected.  For timeseries, this is milliseconds
	spanNulls?:         bool | number
} @cuetsy(kind="interface")

// TODO docs
BarConfig: {
	barAlignment?:   BarAlignment
	barWidthFactor?: number
	barMaxWidth?:    number
} @cuetsy(kind="interface")

// TODO docs
FillConfig: {
	fillColor?:   string
	fillOpacity?: number
	fillBelowTo?: string
} @cuetsy(kind="interface")

// TODO docs
PointsConfig: {
	showPoints?:  VisibilityMode
	pointSize?:   number
	pointColor?:  string
	pointSymbol?: string
} @cuetsy(kind="interface")

// TODO docs
ScaleDistributionConfig: {
	type: ScaleDistribution
	log?: number
	linearThreshold?: number
} @cuetsy(kind="interface")

// TODO docs
AxisConfig: {
	axisPlacement?:     AxisPlacement
	axisColorMode?:     AxisColorMode
	axisLabel?:         string
	axisWidth?:         number
	axisSoftMin?:       number
	axisSoftMax?:       number
	axisGridShow?:      bool
	scaleDistribution?: ScaleDistributionConfig
	axisCenteredZero?:   bool
} @cuetsy(kind="interface")

// TODO docs
HideSeriesConfig: {
	tooltip: bool
	legend:  bool
	viz:     bool
} @cuetsy(kind="interface")

// TODO docs
StackingConfig: {
	mode?:  StackingMode
	group?: string
} @cuetsy(kind="interface")

// TODO docs
StackableFieldConfig: {
	stacking?: StackingConfig
} @cuetsy(kind="interface")

// TODO docs
HideableFieldConfig: {
	hideFrom?: HideSeriesConfig
} @cuetsy(kind="interface")

// TODO docs
GraphTresholdsStyleMode: "off" | "line" | "area" | "line+area" | "series" @cuetsy(kind="enum",memberNames="Off|Line|Area|LineAndArea|Series")

// TODO docs
GraphThresholdsStyleConfig: {
	mode: GraphTresholdsStyleMode
} @cuetsy(kind="interface")

// TODO docs
LegendPlacement: "bottom" | "right" @cuetsy(kind="type")

// TODO docs
// Note: "hidden" needs to remain as an option for plugins compatibility
LegendDisplayMode: "list" | "table" | "hidden" @cuetsy(kind="enum")

// TODO docs
TableSortByFieldState: {
	displayName: string
	desc?:       bool
} @cuetsy(kind="interface")

// TODO docs
SingleStatBaseOptions: {
	OptionsWithTextFormatting
	reduceOptions: ReduceDataOptions
	orientation:   VizOrientation
} @cuetsy(kind="interface")

// TODO docs
ReduceDataOptions: {
	// If true show each row value
	values?: bool
	// if showing all values limit
	limit?: number
	// When !values, pick one value for the whole field
	calcs: [...string]
	// Which fields to show.  By default this is only numeric fields
	fields?: string
} @cuetsy(kind="interface")

// TODO docs
VizOrientation: "auto" | "vertical" | "horizontal" @cuetsy(kind="enum")

// TODO docs
OptionsWithTooltip: {
	tooltip: VizTooltipOptions
} @cuetsy(kind="interface")

// TODO docs
OptionsWithLegend: {
	legend: VizLegendOptions
} @cuetsy(kind="interface")

// TODO docs
OptionsWithTimezones: {
	timezone?: [...string]
} @cuetsy(kind="interface")

// TODO docs
OptionsWithTextFormatting: {
	text?: VizTextDisplayOptions
} @cuetsy(kind="interface")

// TODO docs
BigValueColorMode: "value" | "background" | "none" @cuetsy(kind="enum")

// TODO docs
BigValueGraphMode: "none" | "line" | "area" @cuetsy(kind="enum")

// TODO docs
BigValueJustifyMode: "auto" | "center" @cuetsy(kind="enum")

// TODO docs
BigValueTextMode: "auto" | "value" | "value_and_name" | "name" | "none" @cuetsy(kind="enum",memberNames="Auto|Value|ValueAndName|Name|None")

// TODO -- should not be table specific!
// TODO docs
FieldTextAlignment: "auto" | "left" | "right" | "center" @cuetsy(kind="type")

// TODO docs
TableCellDisplayMode: "auto" | "color-text" | "color-background" | "color-background-solid" | "gradient-gauge" | "lcd-gauge" | "json-view" | "basic" | "image" @cuetsy(kind="enum",memberNames="Auto|ColorText|ColorBackground|ColorBackgroundSolid|GradientGauge|LcdGauge|JSONView|BasicGauge|Image")

// TODO docs
VizTextDisplayOptions: {
	// Explicit title text size
	titleSize?: number
	// Explicit value text size
	valueSize?: number
} @cuetsy(kind="interface")

// TODO docs
TooltipDisplayMode: "single" | "multi" | "none" @cuetsy(kind="enum")

// TODO docs
SortOrder: "asc" | "desc" | "none" @cuetsy(kind="enum",memberNames="Ascending|Descending|None")

// TODO docs
GraphFieldConfig: {
	LineConfig
	FillConfig
	PointsConfig
	AxisConfig
	BarConfig
	StackableFieldConfig
	HideableFieldConfig
	drawStyle?:       GraphDrawStyle
	gradientMode?:    GraphGradientMode
	thresholdsStyle?: GraphThresholdsStyleConfig
	transform?:       GraphTransform
} @cuetsy(kind="interface")

// TODO docs
VizLegendOptions: {
	displayMode:  LegendDisplayMode
	placement:    LegendPlacement
	showLegend: 	bool
	asTable?:     bool
	isVisible?:   bool
  sortBy?:      string
  sortDesc?:    bool
  width?:       number
	calcs:        [...string]
} @cuetsy(kind="interface")

// TODO docs
BarGaugeDisplayMode: "basic" | "lcd" | "gradient" @cuetsy(kind="enum")

// TODO docs
TableFieldOptions: {
	width?:      number
	minWidth?:   number
	align: FieldTextAlignment | *"auto"
	displayMode: TableCellDisplayMode | *"auto"
	hidden?:     bool // ?? default is missing or false ??
	inspect: bool | *false
	filterable?: bool
} @cuetsy(kind="interface")

// TODO docs
VizTooltipOptions: {
	mode: TooltipDisplayMode
	sort: SortOrder
} @cuetsy(kind="interface")
