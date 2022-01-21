import { DataFrameType } from '@grafana/data';

export enum HeatmapCalculationMode {
  Size = 'size',
  Buckets = 'buckets',
}

export interface HeatmapCalculationAxisConfig {
  mode?: HeatmapCalculationMode;
  value?: string; // number or interval string ie 10s
}

export interface HeatmapCalculationOptions {
  xAxis?: HeatmapCalculationAxisConfig;
  yAxis?: HeatmapCalculationAxisConfig;
  xAxisField?: string; // name of the x field
  encoding?: DataFrameType.HeatmapBuckets | DataFrameType.HeatmapSparse;
}
