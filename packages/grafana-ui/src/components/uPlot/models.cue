package grafanaschema

AxisPlacement: "auto" | "top" | "right" | "bottom" | "left" | "hidden" @cuetsy(targetType="enum")
PointVisibility: "auto" | "never" | "always" @cuetsy(targetType="enum")
DrawStyle: "line" | "bars" | "points" @cuetsy(targetType="enum")
LineInterpolation: "linear" | "smooth" | "stepBefore" | "stepAfter" @cuetsy(targetType="enum")
ScaleDistribution: "linear" | "log" | "ordinal" @cuetsy(targetType="enum")
GraphGradientMode: "none" | "opacity" | "hue" | "scheme" @cuetsy(targetType="enum")
StackingMode: "none" | "normal" | "percent" @cuetsy(targetType="enum")
BarValueVisibility: "auto" | "never" | "always" @cuetsy(targetType="enum")
BarAlignment: -1 | 0 | 1 @cuetsy(targetType="enum",memberNames="Before|Center|After")
ScaleOrientation: 0 | 1 @cuetsy(targetType="enum",memberNames="Horizontal|Vertical")
ScaleDirection: 1 | 1 | -1 | -1 @cuetsy(targetType="enum",memberNames="Up|Right|Down|Left")

LineStyle: {
  fill?: "solid" | "dash" | "dot" | "square"
  dash?: [...number]
} @cuetsy(targetType="interface")

LineConfig: {
  lineColor?: string
  lineWidth?: number
  lineInterpolation?: LineInterpolation
  lineStyle?: LineStyle
  spanNulls?: bool | number
} @cuetsy(targetType="interface")

BarConfig: {
  barAlignment?: BarAlignment
  barWidthFactor?: number
  barMaxWidth?: number
} @cuetsy(targetType="interface")

FillConfig: {
  fillColor?: string
  fillOpacity?: number
  fillBelowTo?: string
} @cuetsy(targetType="interface")

PointsConfig: {
  showPoints?: PointVisibility
  pointSize?: number
  pointColor?: string
  pointSymbol?: string
} @cuetsy(targetType="interface")

ScaleDistributionConfig: {
  type: ScaleDistribution
  log?: number
} @cuetsy(targetType="interface")

AxisConfig: {
  axisPlacement?: AxisPlacement
  axisLabel?: string
  axisWidth?: number
  axisSoftMin?: number
  axisSoftMax?: number
  scaleDistribution?: ScaleDistributionConfig
} @cuetsy(targetType="interface")

HideSeriesConfig: {
  tooltip: bool
  legend: bool
  viz: bool
} @cuetsy(targetType="interface")

StackingConfig: {
  mode?: StackingMode
  group?: string
} @cuetsy(targetType="interface")

StackableFieldConfig: {
  stacking?: StackingConfig
} @cuetsy(targetType="interface")

HideableFieldConfig: {
  hideFrom?: HideSeriesConfig
} @cuetsy(targetType="interface")

GraphTresholdsStyleMode: "off" | "line" | "area" | "line+area" | "series" @cuetsy(targetType="enum",memberNames="Off|Line|Area|LineAndArea|Series")

GraphThresholdsStyleConfig: {
  mode: GraphTresholdsStyleMode
} @cuetsy(targetType="interface")

GraphFieldConfig: {
  LineConfig
  FillConfig
  PointsConfig
  AxisConfig
  BarConfig
  StackableFieldConfig
  HideableFieldConfig
  drawStyle?: DrawStyle
  gradientMode?: GraphGradientMode
  thresholdsStyle?: GraphThresholdsStyleConfig
} @cuetsy(targetType="interface")
