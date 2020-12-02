import { SelectableValue } from '@grafana/data';

export enum AxisPlacement {
  Auto = 'auto', // First axis on the left, the rest on the right
  Top = 'top',
  Right = 'right',
  Bottom = 'bottom',
  Left = 'left',
  Hidden = 'hidden',
}

export enum PointMode {
  Auto = 'auto', // will show points when the density is low or line is hidden
  Never = 'never',
  Always = 'always',
}

export enum GraphMode {
  Line = 'line', // default
  Bars = 'bars', // will also have a gap percent
  Points = 'points', // Only show points
}

export enum LineInterpolation {
  Linear = 'linear',
  Staircase = 'staircase', // https://leeoniya.github.io/uPlot/demos/line-stepped.html
  Smooth = 'smooth', // https://leeoniya.github.io/uPlot/demos/line-smoothing.html
}

export interface LineConfig {
  lineColor?: string;
  lineWidth?: number;
  lineInterpolation?: LineInterpolation;
}

export interface AreaConfig {
  fillColor?: string;
  fillOpacity?: number;
}

export interface PointsConfig {
  points?: PointMode;
  pointSize?: number;
  pointColor?: string;
  pointSymbol?: string; // eventually dot,star, etc
}

// Axis is actually unique based on the unit... not each field!
export interface AxisConfig {
  axisPlacement?: AxisPlacement;
  axisLabel?: string;
  axisWidth?: number; // pixels ideally auto?
}

export interface GraphFieldConfig extends LineConfig, AreaConfig, PointsConfig, AxisConfig {
  mode?: GraphMode;
}

export const graphFieldOptions = {
  mode: [
    { label: 'Lines', value: GraphMode.Line },
    { label: 'Bars', value: GraphMode.Bars },
    { label: 'Points', value: GraphMode.Points },
  ] as Array<SelectableValue<GraphMode>>,

  lineInterpolation: [
    { label: 'Linear', value: LineInterpolation.Linear },
    { label: 'Staircase', value: LineInterpolation.Staircase },
    { label: 'Smooth', value: LineInterpolation.Smooth },
  ] as Array<SelectableValue<LineInterpolation>>,

  points: [
    { label: 'Auto', value: PointMode.Auto, description: 'Show points when the density is low' },
    { label: 'Always', value: PointMode.Always },
    { label: 'Never', value: PointMode.Never },
  ] as Array<SelectableValue<PointMode>>,

  axisPlacement: [
    { label: 'Auto', value: AxisPlacement.Auto, description: 'First field on the left, everything else on the right' },
    { label: 'Left', value: AxisPlacement.Left },
    { label: 'Right', value: AxisPlacement.Right },
    { label: 'Hidden', value: AxisPlacement.Hidden },
  ] as Array<SelectableValue<AxisPlacement>>,
};
