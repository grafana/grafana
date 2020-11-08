import { SelectableValue } from '@grafana/data';

export enum AxisPlacement {
  Auto = 'auto', // First axis on the left, the rest on the right
  Top = 'top',
  Right = 'right',
  Bottom = 'bottom',
  Left = 'left',
  Hide = 'hide',
}

export enum PointMode {
  Auto = 'auto', // will show points when the density is low or line is hidden
  Show = 'show',
  Hide = 'hide',
}

export enum LineMode {
  Line = 'line', // default
  Bar = 'bar', // will also have a gap percent
  Staircase = 'staircase', // https://leeoniya.github.io/uPlot/demos/line-stepped.html
  Smooth = 'smooth', // https://leeoniya.github.io/uPlot/demos/line-smoothing.html
  Hide = 'hide',
}

export interface GraphFieldConfig {
  line: LineMode;
  lineWidth: number; // pixels
  fillAlpha: number; // 0-1

  points: PointMode;
  pointRadius: number; // pixels
  symbol: string; // eventually dot,star, etc

  axis: AxisPlacement;
  showAxisLabel?: boolean; // Use the field name to show the label
}

export const graphFieldOptions = {
  points: [
    { label: 'Auto', value: PointMode.Auto, description: 'Show points when the density is low' },
    { label: 'Show', value: PointMode.Show },
    { label: 'Hide', value: PointMode.Hide },
  ] as Array<SelectableValue<PointMode>>,

  line: [
    { label: 'Line', value: LineMode.Line },
    { label: 'Bars', value: LineMode.Bar },
    { label: 'Staircase', value: LineMode.Staircase },
    { label: 'Smooth', value: LineMode.Smooth },
    { label: 'Hide', value: LineMode.Hide },
  ] as Array<SelectableValue<LineMode>>,

  axis: [
    { label: 'Auto', value: AxisPlacement.Auto, description: 'First field on the left, everything else on the right' },
    { label: 'Left', value: AxisPlacement.Left },
    { label: 'Right', value: AxisPlacement.Right },
    { label: 'Hide', value: AxisPlacement.Hide },
  ] as Array<SelectableValue<AxisPlacement>>,
};
