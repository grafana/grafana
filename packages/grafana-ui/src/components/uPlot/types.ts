import React from 'react';
import uPlot, { Options, AlignedData } from 'uplot';

import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';

export type PlotConfig = Pick<
  Options,
  'mode' | 'series' | 'scales' | 'axes' | 'cursor' | 'bands' | 'hooks' | 'select' | 'tzDate' | 'padding'
>;

export interface PlotPluginProps {
  id: string;
}

export type FacetValues = any[];
export type FacetSeries = FacetValues[];
export type FacetedData = [_: null, ...series: FacetSeries];

export interface PlotProps {
  data: AlignedData | FacetedData;
  width: number;
  height: number;
  config: UPlotConfigBuilder;
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
  updateTooltipPosition: (clear?: boolean) => void,
  u: uPlot
) => void;

export interface PlotSelection {
  min: number;
  max: number;

  // selection bounding box, relative to canvas
  bbox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}
