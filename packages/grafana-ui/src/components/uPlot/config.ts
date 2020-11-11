import { SelectableValue } from '@grafana/data';

export enum AxisPlacement {
  Auto = 'auto', // First axis on the left, the rest on the right
  Top = 'top',
  Right = 'right',
  Bottom = 'bottom',
  Left = 'left',
  Hide = 'hide',
}

export function getUPlotSideFromAxis(axis: AxisPlacement) {
  switch (axis) {
    case AxisPlacement.Top:
      return 0;
    case AxisPlacement.Right:
      return 1;
    case AxisPlacement.Bottom:
      return 2;
    case AxisPlacement.Left:
  }
  return 3; // default everythign to the left
}

export enum PointMode {
  Auto = 'auto', // will show points when the density is low or line is hidden
  Always = 'always',
  Never = 'never',
}

export enum GraphMode {
  Line = 'line', // default
  Bar = 'bar', // will also have a gap percent
  Points = 'points', // use the points config
  Staircase = 'staircase', // https://leeoniya.github.io/uPlot/demos/line-stepped.html
  Smooth = 'smooth', // https://leeoniya.github.io/uPlot/demos/line-smoothing.html
}

export interface GraphFieldConfig {
  mode: GraphMode;
  lineWidth: number; // pixels
  fillAlpha: number; // 0-1

  points: PointMode;
  pointRadius: number; // pixels
  symbol: string; // eventually dot,star, etc

  // Axis is actually unique based on the unit... not each field!
  axisPlacement: AxisPlacement;
  axisLabel?: string;
  axisWidth?: number; // pixels ideally auto?
}

export const graphFieldOptions = {
  line: [
    { label: 'Line', value: GraphMode.Line },
    { label: 'Bars', value: GraphMode.Bar },
    { label: 'Points', value: GraphMode.Points },
    // { label: 'Staircase', value: GraphMode.Staircase, description: 'TODO!!!' },
    // { label: 'Smooth', value: GraphMode.Smooth, description: 'TODO!!!' },
  ] as Array<SelectableValue<GraphMode>>,

  points: [
    { label: 'Auto', value: PointMode.Auto, description: 'Show points when the density is low' },
    { label: 'Always', value: PointMode.Always },
    { label: 'Never', value: PointMode.Never },
  ] as Array<SelectableValue<PointMode>>,

  axisPlacement: [
    { label: 'Auto', value: AxisPlacement.Auto, description: 'First field on the left, everything else on the right' },
    { label: 'Left', value: AxisPlacement.Left },
    { label: 'Right', value: AxisPlacement.Right },
    { label: 'Hide', value: AxisPlacement.Hide },
  ] as Array<SelectableValue<AxisPlacement>>,
};
