package common

HeatmapCalculationMode: "size" | "count" @cuetsy(kind="enum",memberNames="Size|Count")

HeatmapCellLayout: "le" | "ge" | "unknown" | "auto" @cuetsy(kind="enum",memberNames="le|ge|unknown|auto")

HeatmapCalculationBucketConfig: {
  mode?: HeatmapCalculationMode
  value?: string
  scale?: ScaleDistributionConfig
} @cuetsy(kind="interface")

HeatmapCalculationOptions: {
  xBuckets?: HeatmapCalculationBucketConfig
  yBuckets?: HeatmapCalculationBucketConfig
} @cuetsy(kind="interface")