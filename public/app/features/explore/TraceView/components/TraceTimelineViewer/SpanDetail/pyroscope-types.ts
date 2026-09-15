// Copied from https://github.com/grafana/grafana-pyroscope-datasource/blob/main/src/types.ts

import type * as common from '@grafana/schema';

type PyroscopeQueryType = 'metrics' | 'profile' | 'both';
type HeatmapQueryType = 'individual' | 'span';

interface GrafanaPyroscopeDataQuery extends common.DataQuery {
  /**
   * If set to true, the response will contain annotations
   */
  annotations?: boolean;
  /**
   * Allows to group the results.
   */
  groupBy: string[];
  /**
   * Specifies the type of heatmap query
   */
  heatmapType: HeatmapQueryType | 'individual';
  /**
   * If set to true, exemplars will be requested
   */
  includeExemplars: boolean;
  /**
   * If set to true, heatmap data will be requested
   */
  includeHeatmap: boolean;
  /**
   * Specifies the query label selectors.
   */
  labelSelector: string;
  /**
   * Sets the maximum number of time series.
   */
  limit?: number;
  /**
   * Sets the maximum number of nodes in the flamegraph.
   */
  maxNodes?: number;
  /**
   * Specifies the query profile id selectors.
   */
  profileIdSelector?: string[];
  /**
   * Specifies the type of profile to query.
   */
  profileTypeId: string;
  /**
   * Specifies the query span selectors.
   */
  spanSelector?: string[];
}

export interface PyroscopeQuery extends GrafanaPyroscopeDataQuery {
  queryType: PyroscopeQueryType;
}
