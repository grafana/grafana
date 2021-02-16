import React from 'react';
import uPlot, { Options, Hooks, AlignedData } from 'uplot';
import { TimeRange } from '@grafana/data';
import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';

export type PlotConfig = Pick<
  Options,
  'series' | 'scales' | 'axes' | 'cursor' | 'bands' | 'hooks' | 'select' | 'tzDate'
>;

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
  data: AlignedData;
  width: number;
  height: number;
  config: UPlotConfigBuilder;
  timeRange: TimeRange;
  children?: React.ReactNode;
}

export abstract class PlotConfigBuilder<P, T> {
  constructor(public props: P) {}
  abstract getConfig(): T;
}
