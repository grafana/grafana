//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currently hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export enum AxisPlacement {
  Auto = 'auto',
  Bottom = 'bottom',
  Hidden = 'hidden',
  Left = 'left',
  Right = 'right',
  Top = 'top',
}
export enum VisibilityMode {
  Auto = 'auto',
  Always = 'always',
  Never = 'never',
}
export enum GraphDrawStyle {
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
/**
 * @alpha
 */
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
export interface PointsConfig {
  pointColor?: string;
  pointSize?: number;
  pointSymbol?: string;
  showPoints?: VisibilityMode;
}
export interface ScaleDistributionConfig {
  log?: number;
  type: ScaleDistribution;
}
export interface HideSeriesConfig {
  viz: boolean;
  legend: boolean;
  tooltip: boolean;
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
  barWidthFactor?: number;
  barMaxWidth?: number;
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
 * Axis is actually unique based on the unit... not each field!
 */
export interface AxisConfig {
  axisPlacement?: AxisPlacement;
  axisLabel?: string;
  axisWidth?: number; // pixels ideally auto?
  axisSoftMin?: number;
  axisSoftMax?: number;
  axisGridShow?: boolean;
  scaleDistribution?: ScaleDistributionConfig;
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
export interface StackableFieldConfig {
  stacking?: StackingConfig;
}

/**
 * @alpha
 */
export enum GraphTresholdsStyleMode {
  Off = 'off',
  Line = 'line',
  Area = 'area',
  LineAndArea = 'line+area',
  Series = 'series',
}

/**
 * @alpha
 */
export interface GraphThresholdsStyleConfig {
  mode: GraphTresholdsStyleMode;
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
    StackableFieldConfig,
    HideableFieldConfig {
  drawStyle?: GraphDrawStyle;
  gradientMode?: GraphGradientMode;
  thresholdsStyle?: GraphThresholdsStyleConfig;
}
