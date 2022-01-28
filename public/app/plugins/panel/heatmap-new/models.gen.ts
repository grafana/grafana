//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import {
  HideableFieldConfig,
  LegendDisplayMode,
  OptionsWithLegend,
  OptionsWithTooltip,
  SortOrder,
  TooltipDisplayMode,
} from '@grafana/schema';
import { HeatmapCalculationOptions } from 'app/core/components/TransformersUI/calculateHeatmap/models.gen';

export const modelVersion = Object.freeze([1, 0]);

export enum HeatmapSourceMode {
  Auto = 'auto',
  Calculate = 'calculate',
  Data = 'data', // Use the data as is
}

export enum HeatmapColorMode {
  Opacity = 'opacity',
  Scheme = 'scheme',
}

export enum HeatmapColorScale {
  Linear = 'linear',
  Exponential = 'exponential',
}

export interface HeatmapColorOptions {
  mode: HeatmapColorMode;
  scheme: string; // when in scheme mode -- the d3 scheme name
  fill: string; // when opacity mode, the target color
  scale: HeatmapColorScale; // for opacity mode
  exponent: number; // when scale== sqrt
  steps: number; // 2-256

  // Clamp the colors to the value range
  field?: string;
  min?: number;
  max?: number;
}

export interface PanelOptions extends OptionsWithLegend, OptionsWithTooltip {
  source: HeatmapSourceMode;

  color: HeatmapColorOptions;
  heatmap?: HeatmapCalculationOptions;

  cellPadding?: number; // was cardPadding
  cellRadius?: number; // was cardRadius

  hideZeroBuckets?: boolean;
  reverseYBuckets?: boolean;
}

export const defaultPanelOptions: PanelOptions = {
  source: HeatmapSourceMode.Auto,
  color: {
    mode: HeatmapColorMode.Scheme,
    scheme: 'Oranges',
    fill: 'red-dark',
    scale: HeatmapColorScale.Exponential,
    exponent: 0.5,
    steps: 128,
  },
  legend: {
    displayMode: LegendDisplayMode.Hidden,
    placement: 'bottom',
    calcs: [],
  },
  tooltip: {
    mode: TooltipDisplayMode.Multi,
    sort: SortOrder.None,
  },
};

export interface PanelFieldConfig extends HideableFieldConfig {
  // TODO points vs lines etc
}

export const defaultPanelFieldConfig: PanelFieldConfig = {
  // default to points?
};
