import uPlot from 'uplot';
import { DataFrame, TimeRange } from '@grafana/data';

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

export type PlotPlugin = {
  id: string;
  /** can mutate provided opts as necessary */
  opts?: (self: uPlot, opts: uPlot.Options) => void;
  hooks: uPlot.PluginHooks;
};

export interface PlotPluginProps {
  id: string;
}

export interface PlotProps {
  data: DataFrame;
  width: number;
  height: number;
  timeRange: TimeRange;
  children: React.ReactNode[];
}
