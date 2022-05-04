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
   * First field is X, the rest are bucket values
   */
  HeatmapBuckets = 'heatmap-buckets',

  /**
   * Explicit fields for:
   *  xMin, yMin, count, ...
   *
   * All values in the grid exist and have regular spacing
   */
  HeatmapScanlines = 'heatmap-scanlines',

  /** Directory listing */
  DirectoryListing = 'directory-listing',
}
