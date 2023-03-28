import { ScaleDistributionConfig } from '@grafana/schema';

export enum HeatmapCalculationMode {
  Size = 'size', // When exponential, this is "splitFactor"
  Count = 'count',
}

export const enum HeatmapCellLayout {
  le = 'le',
  ge = 'ge',
  unknown = 'unknown', // unknown
  auto = 'auto', // becomes unknown
}

export interface HeatmapCalculationBucketConfig {
  mode?: HeatmapCalculationMode;
  value?: string; // number or interval string ie 10s, or log "split" divisor
  scale?: ScaleDistributionConfig;
}

export interface HeatmapCalculationOptions {
  xBuckets?: HeatmapCalculationBucketConfig;
  yBuckets?: HeatmapCalculationBucketConfig;
}
