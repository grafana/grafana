import React from 'react';
import uPlot from 'uplot';
import { DataFrame, TimeRange, TimeZone } from '@grafana/data';

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
  children?: React.ReactNode | React.ReactNode[];
  /** Callback performed when uPlot data is updated */
  onDataUpdate?: (data: uPlot.AlignedData) => {};
  /** Callback performed when uPlot is (re)initialized */
  onPlotInit?: () => {};
}
