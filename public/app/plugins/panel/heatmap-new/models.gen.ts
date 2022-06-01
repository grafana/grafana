//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { AxisConfig, AxisPlacement, HideableFieldConfig, VisibilityMode } from '@grafana/schema';
import { HeatmapCalculationOptions } from 'app/features/transformers/calculateHeatmap/models.gen';

export const modelVersion = Object.freeze([1, 0]);

export enum HeatmapMode {
  Aggregated = 'agg',
  Calculate = 'calculate',
  Accumulated = 'acc', // accumulated
}

export enum HeatmapColorMode {
  Opacity = 'opacity',
  Scheme = 'scheme',
}

export enum HeatmapColorScale {
  Linear = 'linear',
  Exponential = 'exponential',
}

export enum AlignAxis {
  Auto = 'auto',
  Upper = 'upper',
  Middle = 'middle',
  Lower = 'lower',
};

export interface HeatmapColorOptions {
  mode: HeatmapColorMode;
  scheme: string; // when in scheme mode -- the d3 scheme name
  fill: string; // when opacity mode, the target color
  scale: HeatmapColorScale; // for opacity mode
  exponent: number; // when scale== sqrt
  steps: number; // 2-128

  // Clamp the colors to the value range
  min?: number;
  max?: number;
}
export interface YAxisConfig extends AxisConfig {
  unit?: string;
  reverse?: boolean; 
  decimals?: number;
  align: AlignAxis;
}

export interface FilterValueRange {
  min?: number;
  max?: number;
}

export interface HeatmapTooltip {
  show: boolean;
  yHistogram?: boolean;
}
export interface HeatmapLegend {
  show: boolean;
}

export interface ExemplarConfig {
  color: string;
}

export interface PanelOptions {
  mode: HeatmapMode;

  color: HeatmapColorOptions;
  filterValues?: FilterValueRange; // was hideZeroBuckets
  calculate?: HeatmapCalculationOptions;
  showValue: VisibilityMode;

  cellGap?: number; // was cardPadding
  cellSize?: number; // was cardRadius

  yAxis: YAxisConfig;
  legend: HeatmapLegend;

  tooltip: HeatmapTooltip;
  exemplars: ExemplarConfig;
}

export const defaultPanelOptions: PanelOptions = {
  mode: HeatmapMode.Aggregated,
  color: {
    mode: HeatmapColorMode.Scheme,
    scheme: 'Oranges',
    fill: 'dark-orange',
    scale: HeatmapColorScale.Exponential,
    exponent: 0.5,
    steps: 64,
  },
  yAxis: {
    axisPlacement: AxisPlacement.Left,
    align: AlignAxis.Auto,
  },
  showValue: VisibilityMode.Auto,
  tooltip: {
    show: true,
    yHistogram: false,
  },
  legend: {
    show: true,
  },
  exemplars: {
    color: 'rgba(255,0,255,0.7)',
  },
  filterValues: {
    min: 1e-9,
  },
  cellGap: 1,
};

export interface PanelFieldConfig extends HideableFieldConfig {
  // TODO points vs lines etc
}

export const defaultPanelFieldConfig: PanelFieldConfig = {
  // default to points?
};
