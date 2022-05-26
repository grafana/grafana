package schema

// TODO break this up into individual files. Current limitation on this is making codegen sane

AxisPlacement:      "auto" | "top" | "right" | "bottom" | "left" | "hidden" @cuetsy(kind="enum")
VisibilityMode:     "auto" | "never" | "always"                             @cuetsy(kind="enum")
GraphDrawStyle:     "line" | "bars" | "points"                              @cuetsy(kind="enum")
LineInterpolation:  "linear" | "smooth" | "stepBefore" | "stepAfter"        @cuetsy(kind="enum")
ScaleDistribution:  "linear" | "log" | "ordinal"                            @cuetsy(kind="enum")
GraphGradientMode:  "none" | "opacity" | "hue" | "scheme"                   @cuetsy(kind="enum")
StackingMode:       "none" | "normal" | "percent"                           @cuetsy(kind="enum")
GraphTransform:     "constant" | "negative-Y"                               @cuetsy(kind="enum")
BarAlignment:       -1 | 0 | 1                                              @cuetsy(kind="enum",memberNames="Before|Center|After")
ScaleOrientation:   0 | 1                                                   @cuetsy(kind="enum",memberNames="Horizontal|Vertical")
ScaleDirection:     1 | 1 | -1 | -1                                         @cuetsy(kind="enum",memberNames="Up|Right|Down|Left")
LineStyle: {
	fill?: "solid" | "dash" | "dot" | "square"
	dash?: [...number]
} @cuetsy(kind="interface")
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
BarConfig: {
	barAlignment?:   BarAlignment
	barWidthFactor?: number
	barMaxWidth?:    number
} @cuetsy(kind="interface")
FillConfig: {
	fillColor?:   string
	fillOpacity?: number
	fillBelowTo?: string
} @cuetsy(kind="interface")
PointsConfig: {
	showPoints?:  VisibilityMode
	pointSize?:   number
	pointColor?:  string
	pointSymbol?: string
} @cuetsy(kind="interface")
ScaleDistributionConfig: {
	type: ScaleDistribution
	log?: number
} @cuetsy(kind="interface")
AxisConfig: {
	axisPlacement?:     AxisPlacement
	axisLabel?:         string
	axisWidth?:         number
	axisSoftMin?:       number
	axisSoftMax?:       number
	axisGridShow?:      bool
	scaleDistribution?: ScaleDistributionConfig
} @cuetsy(kind="interface")
HideSeriesConfig: {
	tooltip: bool
	legend:  bool
	viz:     bool
} @cuetsy(kind="interface")
StackingConfig: {
	mode?:  StackingMode
	group?: string
} @cuetsy(kind="interface")
StackableFieldConfig: {
	stacking?: StackingConfig
} @cuetsy(kind="interface")
HideableFieldConfig: {
	hideFrom?: HideSeriesConfig
} @cuetsy(kind="interface")
GraphTresholdsStyleMode: "off" | "line" | "area" | "line+area" | "series" @cuetsy(kind="enum",memberNames="Off|Line|Area|LineAndArea|Series")
GraphThresholdsStyleConfig: {
	mode: GraphTresholdsStyleMode
} @cuetsy(kind="interface")
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

LegendPlacement: "bottom" | "right" @cuetsy(kind="type")

LegendDisplayMode: "list" | "table" | "hidden" @cuetsy(kind="enum")

VizLegendOptions: {
	displayMode:  LegendDisplayMode
	placement:    LegendPlacement
	asTable?:     bool
	isVisible?:   bool
  sortBy?:      string
  sortDesc?:    bool
	calcs:        [...string]
} @cuetsy(kind="interface")

TableSortByFieldState: {
	displayName: string
	desc?:       bool
} @cuetsy(kind="interface")

SingleStatBaseOptions: {
	OptionsWithTextFormatting
	reduceOptions: ReduceDataOptions
	orientation:   VizOrientation
} @cuetsy(kind="interface")
// TODO copy back to appropriate place
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
// TODO copy back to appropriate place
VizOrientation: "auto" | "vertical" | "horizontal" @cuetsy(kind="enum")
// TODO copy back to appropriate place
OptionsWithTooltip: {
	// FIXME this field is non-optional in the corresponding TS type
	tooltip?: VizTooltipOptions
} @cuetsy(kind="interface")
// TODO copy back to appropriate place
OptionsWithLegend: {
	// FIXME this field is non-optional in the corresponding TS type
	legend?: VizLegendOptions
} @cuetsy(kind="interface")
// TODO copy back to appropriate place
OptionsWithTextFormatting: {
	text?: VizTextDisplayOptions
} @cuetsy(kind="interface")
// TODO copy back to appropriate place
BigValueColorMode: "value" | "background" | "none" @cuetsy(kind="enum")
// TODO copy back to appropriate place
BigValueGraphMode: "none" | "line" | "area" @cuetsy(kind="enum")
// TODO copy back to appropriate place
BigValueJustifyMode: "auto" | "center" @cuetsy(kind="enum")
// TODO copy back to appropriate place
// TODO does cuetsy handle underscores the expected way?
BigValueTextMode: "auto" | "value" | "value_and_name" | "name" | "none" @cuetsy(kind="enum",memberNames="Auto|Value|ValueAndName|Name|None")
// TODO copy back to appropriate place
BarGaugeDisplayMode: "basic" | "lcd" | "gradient" @cuetsy(kind="enum")

// TODO -- should not be table specific!
FieldTextAlignment: "auto" | "left" | "right" | "center" @cuetsy(kind="type")

TableCellDisplayMode: "auto" | "color-text" | "color-background" | "color-background-solid" | "gradient-gauge" | "lcd-gauge" | "json-view" | "basic" | "image" @cuetsy(kind="enum",memberNames="Auto|ColorText|ColorBackground|ColorBackgroundSolid|GradientGauge|LcdGauge|JSONView|BasicGauge|Image")

TableFieldOptions: {
	width?:      number
	minWidth?:   number
	align:       FieldTextAlignment | *"auto"
	displayMode: TableCellDisplayMode | *"auto"
	hidden?:     bool // ?? default is missing or false ??
	filterable?: bool
} @cuetsy(kind="interface")

VizTextDisplayOptions: {
	// Explicit title text size
	titleSize?: number
	// Explicit value text size
	valueSize?: number
} @cuetsy(kind="interface")

TooltipDisplayMode: "single" | "multi" | "none" @cuetsy(kind="enum")
SortOrder: "asc" | "desc" | "none" @cuetsy(kind="enum")

VizTooltipOptions: {
	mode: TooltipDisplayMode
	sort: SortOrder
} @cuetsy(kind="interface")
