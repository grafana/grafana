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
export enum ScaleDistribution {
  Linear = 'linear',
  Logarithmic = 'log',
}

/**
 * @alpha
 */
export interface LineConfig {
  lineColor?: string;
  lineWidth?: number;
  lineInterpolation?: LineInterpolation;
  lineDash?: number[];
  spanNulls?: boolean;
}

/**
 * @alpha
 */
export interface AreaConfig {
  fillColor?: string;
  fillOpacity?: number;
  fillGradient?: AreaGradientMode;
}

/**
 * @alpha
 */
export enum AreaGradientMode {
  None = 'none',
  Opacity = 'opacity',
  Hue = 'hue',
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
export interface GraphFieldConfig extends LineConfig, AreaConfig, PointsConfig, AxisConfig {
  drawStyle?: DrawStyle;
  hideFrom?: HideSeriesConfig;
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
    { label: 'Linear', value: LineInterpolation.Linear },
    { label: 'Smooth', value: LineInterpolation.Smooth },
    { label: 'Step Before', value: LineInterpolation.StepBefore },
    { label: 'Step After', value: LineInterpolation.StepAfter },
  ] as Array<SelectableValue<LineInterpolation>>,

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
    { label: 'None', value: undefined },
    { label: 'Opacity', value: AreaGradientMode.Opacity },
    { label: 'Hue', value: AreaGradientMode.Hue },
  ] as Array<SelectableValue<AreaGradientMode>>,
};
