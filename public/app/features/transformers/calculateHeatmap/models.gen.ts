import { ScaleDistributionConfig } from '@grafana/schema';

export enum HeatmapCalculationMode {
  Size = 'size', // When exponential, this is "splitFactor"
  Count = 'count',
}

export interface HeatmapCalculationAxisConfig {
  mode?: HeatmapCalculationMode;
  value?: string; // number or interval string ie 10s
  scale?: ScaleDistributionConfig;
}

export interface HeatmapCalculationOptions {
  xAxis?: HeatmapCalculationAxisConfig;
  yAxis?: HeatmapCalculationAxisConfig;
  xAxisField?: string; // name of the x field
}
