//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { AxisConfig, AxisPlacement, HideableFieldConfig, ScaleDistributionConfig, VisibilityMode } from '@grafana/schema';
import { HeatmapBucketLayout, HeatmapCalculationOptions } from 'app/features/transformers/calculateHeatmap/models.gen';

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

export interface BucketFrameOptions {
  value?: string; // value field name
  layout?: HeatmapBucketLayout;
}

export interface PanelOptions {
  calculate?: boolean;
  calculation?: HeatmapCalculationOptions;

  color: HeatmapColorOptions;
  filterValues?: FilterValueRange; // was hideZeroBuckets
  bucketFrame?: BucketFrameOptions;
  showValue: VisibilityMode;

  cellGap?: number; // was cardPadding
  cellRadius?: number; // was cardRadius (not used, but migrated from angular)

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
    exponent: 0.5,
    steps: 64,
  },
  bucketFrame: {
    layout: HeatmapBucketLayout.auto,
  },
  yAxis: {
    axisPlacement: AxisPlacement.Left,
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
