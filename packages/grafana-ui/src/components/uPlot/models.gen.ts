//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export enum AxisPlacement {
  Auto = 'auto',
  Bottom = 'bottom',
  Hidden = 'hidden',
  Left = 'left',
  Right = 'right',
  Top = 'top',
}
export enum PointVisibility {
  Always = 'always',
  Auto = 'auto',
  Never = 'never',
}
export enum DrawStyle {
  Bars = 'bars',
  Line = 'line',
  Points = 'points',
}
export enum LineInterpolation {
  Linear = 'linear',
  Smooth = 'smooth',
  StepAfter = 'stepAfter',
  StepBefore = 'stepBefore',
}
export enum ScaleDistribution {
  Linear = 'linear',
  Log = 'log',
  Ordinal = 'ordinal',
}
export enum GraphGradientMode {
  Hue = 'hue',
  None = 'none',
  Opacity = 'opacity',
  Scheme = 'scheme',
}
export interface LineStyle {
  dash?: number[];
  fill?: 'solid' | 'dash' | 'dot' | 'square';
}
export interface LineConfig {
  lineColor?: string;
  lineInterpolation?: LineInterpolation;
  lineStyle?: LineStyle;
  lineWidth?: number;
  spanNulls?: boolean;
}
export interface FillConfig {
  fillBelowTo?: string;
  fillColor?: string;
  fillOpacity?: number;
}
export interface PointsConfig {
  pointColor?: string;
  pointSize?: number;
  pointSymbol?: string;
  showPoints?: PointVisibility;
}
export interface ScaleDistributionConfig {
  log?: number;
  type: ScaleDistribution;
}
export interface AxisConfig {
  axisLabel?: string;
  axisPlacement?: AxisPlacement;
  axisSoftMax?: number;
  axisSoftMin?: number;
  axisWidth?: number;
  scaleDistribution?: ScaleDistributionConfig;
}
export interface HideSeriesConfig {
  graph: boolean;
  legend: boolean;
  tooltip: boolean;
}
export interface GraphFieldConfig extends LineConfig, FillConfig, PointsConfig, AxisConfig {
  drawStyle?: DrawStyle;
  gradientMode?: GraphGradientMode;
  hideFrom?: HideSeriesConfig;
}
