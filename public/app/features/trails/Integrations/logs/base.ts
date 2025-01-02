import { DataSourceSettings } from '@grafana/data';

export type FoundLokiDataSource = Pick<DataSourceSettings, 'name' | 'uid'>;

/**
 * Defines the interface for connecting metrics and their related logs.
 * Implementations should provide methods for retrieving Loki data sources associated
 * with a metric, and creating a Loki query expression for a given metric and data source.
 *
 * By using this interface, the `RelatedLogsScene` can orchestrate
 * the retrieval of logs without needing to know the specifics of how we're
 * associating logs with a given metric.
 */
export interface MetricsLogsConnector {
  /**
   * Retrieves the Loki data sources associated with the specified metric.
   */
  getDataSources(selectedMetric: string): Promise<FoundLokiDataSource[]>;

  /**
   * Constructs a Loki query expression for the specified metric and data source.
   */
  getLokiQueryExpr(selectedMetric: string, datasourceUid: string): string;
}

export function createMetricsLogsConnector<T extends MetricsLogsConnector>(connector: T): T {
  return connector;
}
