import React from 'react';
import uPlot, { Options, AlignedData } from 'uplot';
import { TimeRange } from '@grafana/data';
import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';

export type PlotConfig = Pick<
  Options,
  'series' | 'scales' | 'axes' | 'cursor' | 'bands' | 'hooks' | 'select' | 'tzDate'
>;

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
  // Reference to uPlot instance
  plotRef?: (u: uPlot) => void;
}

export abstract class PlotConfigBuilder<P, T> {
  constructor(public props: P) {}
  abstract getConfig(): T;
}

/**
 * @alpha
 */
export type PlotTooltipInterpolator = (
  updateActiveSeriesIdx: (sIdx: number | null) => void,
  updateActiveDatapointIdx: (dIdx: number | null) => void,
  updateTooltipPosition: (clear?: boolean) => void
) => (u: uPlot) => void;
