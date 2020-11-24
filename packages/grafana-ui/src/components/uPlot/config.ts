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
  Always = 'always',
  Never = 'never',
}

export enum GraphMode {
  Line = 'line', // default
  Bar = 'bar', // will also have a gap percent
  Points = 'points', // Only show points
}

export enum LineInterpolation {
  Linear = 'linear',
  Staircase = 'staircase', // https://leeoniya.github.io/uPlot/demos/line-stepped.html
  Smooth = 'smooth', // https://leeoniya.github.io/uPlot/demos/line-smoothing.html
}

export interface GraphFieldConfig {
  mode: GraphMode;

  lineMode?: LineInterpolation;
  lineWidth?: number; // pixels
  fillAlpha?: number; // 0-1

  points?: PointMode;
  pointRadius?: number; // pixels
  symbol?: string; // eventually dot,star, etc

  // Axis is actually unique based on the unit... not each field!
  axisPlacement?: AxisPlacement;
  axisLabel?: string;
  axisWidth?: number; // pixels ideally auto?
}

export const graphFieldOptions = {
  mode: [
    { label: 'Lines', value: GraphMode.Line },
    { label: 'Bars', value: GraphMode.Bar },
    { label: 'Points', value: GraphMode.Points },
  ] as Array<SelectableValue<GraphMode>>,

  lineMode: [
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
