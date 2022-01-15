export enum HeatmapFrameEncoding {
  // X is the first axis
  // Each field represents a range
  BUCKETS = 'heatmap-bucket-fields',

  // Explicit field for:
  //  xmin, xmax, ymin, ymax, count (xLayout, yLayout, meta)?
  SPARSE = 'heatmap-sparse-values',
}

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
  encoding?: HeatmapFrameEncoding;
}
