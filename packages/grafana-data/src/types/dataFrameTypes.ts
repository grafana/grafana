/**
 * See also:
 * https://github.com/grafana/grafana-plugin-sdk-go/blob/main/data/frame_type.go
 *
 * @public
 */
export enum DataFrameType {
  TimeSeriesWide = 'timeseries-wide',
  TimeSeriesLong = 'timeseries-long',

  /** @deprecated in favor of TimeSeriesMulti */
  TimeSeriesMany = 'timeseries-many',

  TimeSeriesMulti = 'timeseries-multi',

  /** Numeric types: https://grafana.com/developers/dataplane/numeric */
  NumericWide = 'numeric-wide',
  NumericMulti = 'numeric-multi',
  NumericLong = 'numeric-long',

  /** Logs types: https://grafana.com/developers/dataplane/logs */
  LogLines = 'log-lines',

  /** Directory listing */
  DirectoryListing = 'directory-listing',

  /**
   * First field is X, the rest are ordinal values used as rows in the heatmap
   */
  HeatmapRows = 'heatmap-rows',

  /**
   * Explicit fields for:
   *  xMin, yMin, count, ...
   *
   * All values in the grid exist and have regular spacing
   *
   * If the y value is actually ordinal, use `meta.custom` to specify the bucket lookup values
   */
  HeatmapCells = 'heatmap-cells',

  /**
   * Explicit fields for:
   *  xMin, xMax, count
   */
  Histogram = 'histogram',

  /**
   * Legacy graph frame edges
   */
  GraphEdgesLong = 'graph-edges-long',
  /**
   * Legacy graph frame nodes
   */
  GraphNodesLong = 'graph-nodes-long',
  /**
   * @alpha - experimental
   * Proposed graph frame edges
   */
  GraphEdgesWide = 'graph-edges-wide',
  /**
   * @alpha - experimental
   * Proposed graph frame nodes
   */
  GraphNodesWide = 'graph-nodes-wide',
  /**
   * @alpha - experimental
   * Proposed mulit-frame graph nodes
   */
  GraphNodesMulti = 'graph-nodes-multi',
  /**
   * @alpha - experimental
   * Proposed multi-frame graph edges
   */
  GraphEdgesMulti = 'graph-edges-multi',
}
