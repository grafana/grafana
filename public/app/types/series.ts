import { PluginMeta } from './plugins';
import { TimeSeries, TimeRange, RawTimeRange } from '@grafana/ui';

export interface DataQueryResponse {
  data: TimeSeries[];
}

export interface DataQuery {
  refId: string;
  [key: string]: any;
}

export interface DataQueryOptions {
  timezone: string;
  range: TimeRange;
  rangeRaw: RawTimeRange;
  targets: DataQuery[];
  panelId: number;
  dashboardId: number;
  cacheTimeout?: string;
  interval: string;
  intervalMs: number;
  maxDataPoints: number;
  scopedVars: object;
}

export interface DataSourceApi {
  /**
   *  min interval range
   */
  interval?: string;

  /**
   * Imports queries from a different datasource
   */
  importQueries?(queries: DataQuery[], originMeta: PluginMeta): Promise<DataQuery[]>;

  /**
   * Initializes a datasource after instantiation
   */
  init?: () => void;

  /**
   * Main metrics / data query action
   */
  query(options: DataQueryOptions): Promise<DataQueryResponse>;

  /**
   * Test & verify datasource settings & connection details
   */
  testDatasource(): Promise<any>;
}
