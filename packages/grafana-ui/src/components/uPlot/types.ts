import React from 'react';
import uPlot, { Options, Hooks } from 'uplot';
import { DataFrame, TimeRange, TimeZone } from '@grafana/data';
import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';

export type PlotConfig = Pick<Options, 'series' | 'scales' | 'axes' | 'cursor' | 'bands' | 'hooks' | 'select'>;

export type PlotPlugin = {
  id: string;
  /** can mutate provided opts as necessary */
  opts?: (self: uPlot, opts: Options) => void;
  hooks: Hooks.ArraysOrFuncs;
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
  children?: React.ReactNode;
}

export abstract class PlotConfigBuilder<P, T> {
  constructor(public props: P) {}
  abstract getConfig(): T;
}
