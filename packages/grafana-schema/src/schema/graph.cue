package schema

AxisPlacement:      "auto" | "top" | "right" | "bottom" | "left" | "hidden" @cuetsy(kind="enum")
VisibilityMode:     "auto" | "never" | "always"                             @cuetsy(kind="enum")
GraphDrawStyle:     "line" | "bars" | "points"                              @cuetsy(kind="enum")
LineInterpolation:  "linear" | "smooth" | "stepBefore" | "stepAfter"        @cuetsy(kind="enum")
ScaleDistribution:  "linear" | "log" | "ordinal"                            @cuetsy(kind="enum")
GraphGradientMode:  "none" | "opacity" | "hue" | "scheme"                   @cuetsy(kind="enum")
StackingMode:       "none" | "normal" | "percent"                           @cuetsy(kind="enum")
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
} @cuetsy(kind="interface")
