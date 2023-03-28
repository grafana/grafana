//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { AxisConfig, AxisPlacement, HideableFieldConfig, ScaleDistributionConfig, VisibilityMode } from '@grafana/schema';
import { HeatmapCellLayout, HeatmapCalculationOptions } from 'app/features/transformers/calculateHeatmap/models.gen';

export const modelVersion = Object.freeze([1, 0]);

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
  steps: number; // 2-128

  reverse: boolean;

  // Clamp the colors to the value range
  min?: number;
  max?: number;
}
export interface YAxisConfig extends AxisConfig {
  unit?: string;
  reverse?: boolean;
  decimals?: number;
  // Only used when the axis is not ordinal
  min?: number;
  max?: number;
}

export interface CellValues {
  unit?: string;
  decimals?: number;
}

export interface FilterValueRange {
  le?: number;
  ge?: number;
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

export interface RowsHeatmapOptions {
  value?: string; // value field name
  layout?: HeatmapCellLayout;
}

export interface PanelOptions {
  calculate?: boolean;
  calculation?: HeatmapCalculationOptions;

  color: HeatmapColorOptions;
  filterValues?: FilterValueRange; // was hideZeroBuckets
  rowsFrame?: RowsHeatmapOptions;
  showValue: VisibilityMode;

  cellGap?: number; // was cardPadding
  cellRadius?: number; // was cardRadius (not used, but migrated from angular)
  cellValues?: CellValues;

  yAxis: YAxisConfig;

  legend: HeatmapLegend;

  tooltip: HeatmapTooltip;
  exemplars: ExemplarConfig;
}

export const defaultPanelOptions: PanelOptions = {
  calculate: false,
  color: {
    mode: HeatmapColorMode.Scheme,
    scheme: 'Oranges',
    fill: 'dark-orange',
    scale: HeatmapColorScale.Exponential,
    reverse: false,
    exponent: 0.5,
    steps: 64,
  },
  rowsFrame: {
    layout: HeatmapCellLayout.auto,
  },
  yAxis: {
    axisPlacement: AxisPlacement.Left,
  },
  cellValues: {

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
    le: 1e-9,
  },
  cellGap: 1,
};

export interface PanelFieldConfig extends HideableFieldConfig {
  scaleDistribution?: ScaleDistributionConfig;
}

export const defaultPanelFieldConfig: PanelFieldConfig = {};
