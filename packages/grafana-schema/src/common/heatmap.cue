package common

HeatmapCalculationMode: "size" | "count" @cuetsy(kind="enum")

HeatmapCellLayout: "le" | "ge" | "unknown" | "auto" @cuetsy(kind="enum",memberNames="le|ge|unknown|auto")

HeatmapCalculationBucketConfig: {
  // Sets the bucket calculation mode
  mode?: HeatmapCalculationMode
  // The number of buckets to use for the axis in the heatmap
  value?: string
  // Controls the scale of the buckets
  scale?: ScaleDistributionConfig
} @cuetsy(kind="interface")

HeatmapCalculationOptions: {
  // The number of buckets to use for the xAxis in the heatmap
  xBuckets?: HeatmapCalculationBucketConfig
  // The number of buckets to use for the yAxis in the heatmap
  yBuckets?: HeatmapCalculationBucketConfig
} @cuetsy(kind="interface")