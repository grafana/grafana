/**
 * See also:
 * https://github.com/grafana/grafana-plugin-sdk-go/blob/main/data/frame_type.go
 *
 * @public
 */
export enum DataFrameType {
  TimeSeriesWide = 'timeseries-wide',
  TimeSeriesLong = 'timeseries-long',
  TimeSeriesMany = 'timeseries-many',

  /**
   * First field is X, the rest are bucket counds
   */
  HeatmapBuckets = 'heatmap-buckets',

  /**
   * Explicit fields for:
   *  xmin, xmax, ymin, ymax, count (xLayout, yLayout, meta)?
   */
  HeatmapSparse = 'heatmap-sparse',
}
