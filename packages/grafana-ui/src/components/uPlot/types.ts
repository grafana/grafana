import React from 'react';
import uPlot, { Options, Series, Hooks } from 'uplot';
import { DataFrame, TimeRange, TimeZone } from '@grafana/data';
import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';

export type PlotSeriesConfig = Pick<Options, 'series' | 'scales' | 'axes' | 'cursor'>;
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
  data: AlignedFrameWithGapTest;
  timeRange: TimeRange;
  timeZone: TimeZone;
  width: number;
  height: number;
  config: UPlotConfigBuilder;
  children?: React.ReactElement[];
}

export abstract class PlotConfigBuilder<P, T> {
  constructor(public props: P) {}
  abstract getConfig(): T;
}

export interface AlignedFrameWithGapTest {
  frame: DataFrame;
  isGap: Series.isGap;
}
