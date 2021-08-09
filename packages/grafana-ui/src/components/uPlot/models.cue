package grafanaschema

AxisPlacement: "auto" | "top" | "right" | "bottom" | "left" | "hidden" @cuetsy(targetType="enum")
PointVisibility: "auto" | "never" | "always" @cuetsy(targetType="enum")
DrawStyle: "line" | "bars" | "points" @cuetsy(targetType="enum")
LineInterpolation: "linear" | "smooth" | "stepBefore" | "stepAfter" @cuetsy(targetType="enum")
ScaleDistribution: "linear" | "log" | "ordinal" @cuetsy(targetType="enum")
GraphGradientMode: "none" | "opacity" | "hue" | "scheme" @cuetsy(targetType="enum")

LineStyle: {
  fill?: "solid" | "dash" | "dot" | "square"
  dash?: [...number]
} @cuetsy(targetType="interface")

LineConfig: {
  lineColor?: string
  lineWidth?: number
  lineInterpolation?: LineInterpolation
  lineStyle?: LineStyle
  spanNulls?: bool
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

// TODO This is the same composition as what's used in the timeseries panel's
// PanelFieldConfig. If that's the only place it's used, it probably shouldn't
// be assembled here, too
GraphFieldConfig: LineConfig & FillConfig & PointsConfig & AxisConfig & {
  drawStyle?: DrawStyle
  gradientMode?: GraphGradientMode
  hideFrom?: HideSeriesConfig
} @cuetsy(targetType="interface")
