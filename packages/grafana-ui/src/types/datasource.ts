import { TimeRange, RawTimeRange } from './time';
import { TimeSeries } from './series';
import { PluginExports, PluginMeta } from './plugin';

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

export interface QueryFix {
  type: string;
  label: string;
  action?: QueryFixAction;
}

export interface QueryFixAction {
  type: string;
  query?: string;
  preventSubmit?: boolean;
}

export interface QueryHint {
  type: string;
  label: string;
  fix?: QueryFix;
}

export interface DataSourceApi {
  name: string;
  meta: PluginMeta;
  pluginExports: PluginExports;

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

  /**
   *  Get hints for query improvements
   */
  getQueryHints(query: DataQuery, results: any[], ...rest: any): QueryHint[];
}

export interface DataSourceSettings {
  id: number;
  orgId: number;
  name: string;
  typeLogoUrl: string;
  type: string;
  access: string;
  url: string;
  password: string;
  user: string;
  database: string;
  basicAuth: boolean;
  basicAuthPassword: string;
  basicAuthUser: string;
  isDefault: boolean;
  jsonData: { authType: string; defaultRegion: string };
  readOnly: boolean;
  withCredentials: boolean;
}

export interface DataSourceSelectItem {
  name: string;
  value: string | null;
  meta: PluginMeta;
  sort: string;
}
