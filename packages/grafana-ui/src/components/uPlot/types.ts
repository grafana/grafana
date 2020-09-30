import React from 'react';
import uPlot from 'uplot';
import { DataFrame, FieldColor, TimeRange, TimeZone } from '@grafana/data';

export type NullValuesMode = 'null' | 'connected' | 'asZero';

export enum MicroPlotAxisSide {
  top = 0,
  right = 1,
  bottom = 2,
  left = 3,
}

interface AxisConfig {
  label: string;
  side: number;
  grid: boolean;
  width: number;
}

interface LineConfig {
  show: boolean;
  width: number;
  color: FieldColor;
}
interface PointConfig {
  show: boolean;
  radius: number;
}
interface BarsConfig {
  show: boolean;
}
interface FillConfig {
  alpha: number;
}

export interface GraphCustomFieldConfig {
  axis: AxisConfig;
  line: LineConfig;
  points: PointConfig;
  bars: BarsConfig;
  fill: FillConfig;
  nullValues: NullValuesMode;
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
  timeZone: TimeZone;
  children: React.ReactNode[];
}
