package common

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
GraphTresholdsStyleMode: "off" | "line" | "dashed" | "area" | "line+area" | "dashed+area" | "series" @cuetsy(kind="enum",memberNames="Off|Line|Dashed|Area|LineAndArea|DashedAndArea|Series")

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
	timezone?: [...TimeZone]
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

// Enum expressing the possible display modes
// for the bar gauge component of Grafana UI
BarGaugeDisplayMode: "basic" | "lcd" | "gradient" @cuetsy(kind="enum")

// TODO docs
VizTooltipOptions: {
	mode: TooltipDisplayMode
	sort: SortOrder
} @cuetsy(kind="interface")

Labels: {
	[string]: string
} @cuetsy(kind="interface")

// TODO docs | generic type
ScopedVar: {
  text: _
  value: _
  [string]: _
} @cuetsy(kind="interface")

// TODO docs
ScopedVars: {
	[string]: ScopedVar
} @cuetsy(kind="interface")

// TODO Should be moved to common data query?
QueryResultBase: {
   // Matches the query target refId
  refId?: string
   // Used by some backend data sources to communicate back info about the execution (generated sql, timing)
  meta?: QueryResultMeta
} @cuetsy(kind="interface")

// TODO docs
QueryResultMeta: {
	type?: DataFrameType
	// DataSource Specific Values
	custom?: {...}
	// Stats
	stats?: [...QueryResultMetaStat]
	// Meta notices
	notices?: [...QueryResultMetaNotice]
	// Used to track transformation ids that where part of the processing
  transformations?: [...string]
  // Currently used to show results in Explore only in preferred visualisation option
  preferredVisualisationType?: PreferredVisualisationType
  // The path for live stream updates for this frame
  channel?: string
  // Did the query response come from the cache
  isCachedResponse?: bool
	// Optionally identify which topic the frame should be assigned to.
	// A value specified in the response will override what the request asked for.
	dataTopic?: DataTopic
	// This is the raw query sent to the underlying system.  All macros and templating
  // as been applied.  When metadata contains this value, it will be shown in the query inspector
  executedQueryString?: string
  // A browsable path on the datasource
  path?: string
  //defaults to '/'
  pathSeparator?: string
  // Legacy data source specific, should be moved to custom
  // used by log models and loki
  searchWords?: [...string]
  // used by log models and loki
  limit?: int64
  // used to keep track of old json doc values
  json?: bool
  instant?: bool
} @cuetsy(kind="interface")

// TODO this is an enum with one field
// Attached to query results (not persisted)
DataTopic: "annotations" @cuetsy(kind="type")

// TODO extends FieldConfig
QueryResultMetaStat: {
  displayName: string
  value: int64
} @cuetsy(kind="interface")

QueryResultMetaNotice: {
  // Specify the notice severity
  severity: "info" | "warning" | "error" @cuetsy(kind="type")
  // Notice descriptive text
  text: string
  // An optional link that may be displayed in the UI.
  // This value may be an absolute URL or relative to grafana root
  link?: string
  // Optionally suggest an appropriate tab for the panel inspector
  inspect?: "meta" | "error" | "data" | "stats" @cuetsy(kind="type")
} @cuetsy(kind="interface")

PreferredVisualisationType: "graph" | "table" | "logs" | "trace" | "nodeGraph" | "flamegraph" | "rawPrometheus" @cuetsy(kind="type")
