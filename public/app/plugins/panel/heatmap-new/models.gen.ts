//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { HideableFieldConfig, LegendDisplayMode, OptionsWithLegend, VisibilityMode } from '@grafana/schema';
import { HeatmapCalculationOptions } from 'app/features/transformers/calculateHeatmap/models.gen';

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

export interface HeatmapTooltip {
  show: boolean;
  yHistogram?: boolean;
}

export interface PanelOptions extends OptionsWithLegend {
  source: HeatmapSourceMode;

  color: HeatmapColorOptions;
  heatmap?: HeatmapCalculationOptions;
  showValue: VisibilityMode;

  cellGap?: number; // was cardPadding
  cellSize?: number; // was cardRadius

  hideThreshold?: number; // was hideZeroBuckets
  yAxisLabels?: string;
  yAxisReverse?: boolean;

  tooltip: HeatmapTooltip;
}

export const defaultPanelOptions: PanelOptions = {
  source: HeatmapSourceMode.Auto,
  color: {
    mode: HeatmapColorMode.Scheme,
    scheme: 'Oranges',
    fill: 'dark-orange',
    scale: HeatmapColorScale.Exponential,
    exponent: 0.5,
    steps: 64,
  },
  showValue: VisibilityMode.Auto,
  legend: {
    displayMode: LegendDisplayMode.Hidden,
    placement: 'bottom',
    calcs: [],
  },
  tooltip: {
    show: true,
    yHistogram: false,
  },
  cellGap: 3,
};

export interface PanelFieldConfig extends HideableFieldConfig {
  // TODO points vs lines etc
}

export const defaultPanelFieldConfig: PanelFieldConfig = {
  // default to points?
};
