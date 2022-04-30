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
  HeatmapRowsDense = 'heatmap-rows-dense',

  /**
   * Explicit fields for:
   *  xMin, yMin, count, ...
   *
   * All values in the grid exist and have regular spacing
   */
  HeatmapCellsDense = 'heatmap-cells-dense',

  /**
   * Explicit fields for:
   *  xMin, yMin, count, ...
   *
   * Sparse in x and/or y
   */
  HeatmapCellsSparse = 'heatmap-cells-sparse',

  /** Directory listing */
  DirectoryListing = 'directory-listing',
}
