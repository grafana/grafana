import React from 'react';
import uPlot from 'uplot';
import { DataFrame, TimeRange, TimeZone } from '@grafana/data';
import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';

export type PlotSeriesConfig = Pick<uPlot.Options, 'series' | 'scales' | 'axes'>;
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
  timeRange: TimeRange;
  timeZone: TimeZone;
  width: number;
  height: number;
  config: UPlotConfigBuilder;
  children?: React.ReactElement[];
  /** Callback performed when uPlot data is updated */
  onDataUpdate?: (data: uPlot.AlignedData) => {};
  /** Callback performed when uPlot is (re)initialized */
  onPlotInit?: () => {};
}

export abstract class PlotConfigBuilder<P, T> {
  constructor(protected props: P) {}
  abstract getConfig(): T;
}

export enum AxisSide {
  Top, // 0
  Right, // 1
  Bottom, // 2
  Left, // 3
}
