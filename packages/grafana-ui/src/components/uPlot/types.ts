export enum MicroPlotAxisSide {
  top = 0,
  right = 1,
  bottom = 2,
  left = 3,
}

export interface GraphCustomFieldConfig {
  showLines: boolean;
  lineWidth: number;
  limeMode: 'connect' | 'staircase';

  showPoints: boolean;
  pointRadius: number;

  showBars: boolean;

  fillAlpha: number; // 0-1

  showAxis: boolean;
  axisWidth: number; // empty is auto
  axisLabel: string; // display text
}
