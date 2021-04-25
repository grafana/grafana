import { SelectableValue } from '@grafana/data';

/**
 * @alpha
 */
export enum AxisPlacement {
  Auto = 'auto', // First axis on the left, the rest on the right
  Top = 'top',
  Right = 'right',
  Bottom = 'bottom',
  Left = 'left',
  Hidden = 'hidden',
}

/**
 * @alpha
 */
export enum PointVisibility {
  Auto = 'auto', // will show points when the density is low or line is hidden
  Never = 'never',
  Always = 'always',
}

/**
 * @alpha
 */
export enum DrawStyle {
  Line = 'line', // default
  Bars = 'bars', // will also have a gap percent
  Points = 'points', // Only show points
}

/**
 * @alpha
 */
export enum LineInterpolation {
  Linear = 'linear',
  Smooth = 'smooth',
  StepBefore = 'stepBefore',
  StepAfter = 'stepAfter',
}

/**
 * @alpha
 */
export enum BarAlignment {
  Before = -1,
  Center = 0,
  After = 1,
}

/**
 * @alpha
 */
export enum ScaleDistribution {
  Linear = 'linear',
  Logarithmic = 'log',
  Ordinal = 'ordinal',
}

/**
 * @alpha
 */
export enum ScaleOrientation {
  Horizontal = 0,
  Vertical = 1,
}

/**
 * @alpha
 */

export enum ScaleDirection {
  Up = 1,
  Right = 1,
  Down = -1,
  Left = -1,
}

/**
 * @alpha
 */
export interface LineStyle {
  fill?: 'solid' | 'dash' | 'dot' | 'square';
  dash?: number[];
}

/**
 * @alpha
 */
export interface LineConfig {
  lineColor?: string;
  lineWidth?: number;
  lineInterpolation?: LineInterpolation;
  lineStyle?: LineStyle;

  /**
   * Indicate if null values should be treated as gaps or connected.
   * When the value is a number, it represents the maximum delta in the
   * X axis that should be considered connected.  For timeseries, this is milliseconds
   */
  spanNulls?: boolean | number;
}

/**
 * @alpha
 */
export interface BarConfig {
  barAlignment?: BarAlignment;
}

/**
 * @alpha
 */
export interface FillConfig {
  fillColor?: string;
  fillOpacity?: number;
  fillBelowTo?: string; // name of the field
}

/**
 * @alpha
 */
export enum GraphGradientMode {
  None = 'none',
  Opacity = 'opacity',
  Hue = 'hue',
  Scheme = 'scheme',
}

/**
 * @alpha
 */
export interface PointsConfig {
  showPoints?: PointVisibility;
  pointSize?: number;
  pointColor?: string;
  pointSymbol?: string; // eventually dot,star, etc
}

/**
 * @alpha
 */
export interface ScaleDistributionConfig {
  type: ScaleDistribution;
  log?: number;
}

/**
 * @alpha
 * Axis is actually unique based on the unit... not each field!
 */
export interface AxisConfig {
  axisPlacement?: AxisPlacement;
  axisLabel?: string;
  axisWidth?: number; // pixels ideally auto?
  axisSoftMin?: number;
  axisSoftMax?: number;
  scaleDistribution?: ScaleDistributionConfig;
}

/**
 * @alpha
 */
export interface HideSeriesConfig {
  tooltip: boolean;
  legend: boolean;
  graph: boolean;
}

/**
 * @alpha
 */
export interface HideableFieldConfig {
  hideFrom?: HideSeriesConfig;
}

/**
 * @alpha
 */
export enum StackingMode {
  None = 'none',
  Normal = 'normal',
  Percent = 'percent',
}

/**
 * @alpha
 */
export interface StackingConfig {
  mode?: StackingMode;
  group?: string;
}

/**
 * @alpha
 */
export enum GraphTresholdsDisplayMode {
  None = 'none',
  Line = 'line',
  Area = 'area',
}

/**
 * @alpha
 */
export interface GraphThresholdsConfig {
  mode: GraphTresholdsDisplayMode;
}

/**
 * @alpha
 */
export interface GraphFieldConfig
  extends LineConfig,
    FillConfig,
    PointsConfig,
    AxisConfig,
    BarConfig,
    HideableFieldConfig {
  drawStyle?: DrawStyle;
  gradientMode?: GraphGradientMode;
  stacking?: StackingConfig;
  thresholds?: GraphThresholdsConfig;
}

/**
 * @alpha
 */
export const graphFieldOptions = {
  drawStyle: [
    { label: 'Lines', value: DrawStyle.Line },
    { label: 'Bars', value: DrawStyle.Bars },
    { label: 'Points', value: DrawStyle.Points },
  ] as Array<SelectableValue<DrawStyle>>,

  lineInterpolation: [
    { description: 'Linear', value: LineInterpolation.Linear, icon: 'gf-interpolation-linear' },
    { description: 'Smooth', value: LineInterpolation.Smooth, icon: 'gf-interpolation-smooth' },
    { description: 'Step before', value: LineInterpolation.StepBefore, icon: 'gf-interpolation-step-before' },
    { description: 'Step after', value: LineInterpolation.StepAfter, icon: 'gf-interpolation-step-after' },
  ] as Array<SelectableValue<LineInterpolation>>,

  barAlignment: [
    { description: 'Before', value: BarAlignment.Before, icon: 'gf-bar-alignment-before' },
    { description: 'Center', value: BarAlignment.Center, icon: 'gf-bar-alignment-center' },
    { description: 'After', value: BarAlignment.After, icon: 'gf-bar-alignment-after' },
  ] as Array<SelectableValue<BarAlignment>>,

  showPoints: [
    { label: 'Auto', value: PointVisibility.Auto, description: 'Show points when the density is low' },
    { label: 'Always', value: PointVisibility.Always },
    { label: 'Never', value: PointVisibility.Never },
  ] as Array<SelectableValue<PointVisibility>>,

  axisPlacement: [
    { label: 'Auto', value: AxisPlacement.Auto, description: 'First field on the left, everything else on the right' },
    { label: 'Left', value: AxisPlacement.Left },
    { label: 'Right', value: AxisPlacement.Right },
    { label: 'Hidden', value: AxisPlacement.Hidden },
  ] as Array<SelectableValue<AxisPlacement>>,

  fillGradient: [
    { label: 'None', value: GraphGradientMode.None },
    { label: 'Opacity', value: GraphGradientMode.Opacity },
    { label: 'Hue', value: GraphGradientMode.Hue },
    //  { label: 'Color scheme', value: GraphGradientMode.Scheme },
  ] as Array<SelectableValue<GraphGradientMode>>,

  stacking: [
    { label: 'Off', value: StackingMode.None },
    { label: 'Normal', value: StackingMode.Normal },
  ] as Array<SelectableValue<StackingMode>>,

  thresholdsMode: [
    { label: 'Off', value: GraphTresholdsDisplayMode.None },
    { label: 'Line', value: GraphTresholdsDisplayMode.Line },
    { label: 'Area', value: GraphTresholdsDisplayMode.Area },
  ] as Array<SelectableValue<GraphTresholdsDisplayMode>>,
};
