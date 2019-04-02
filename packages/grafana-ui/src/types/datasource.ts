import { ComponentClass } from 'react';
import { TimeRange, RawTimeRange } from './time';
import { PluginMeta } from './plugin';
import { TableData, TimeSeries, SeriesData } from './data';

export class DataSourcePlugin<TQuery extends DataQuery = DataQuery> {
  datasource: DataSourceApi<TQuery>;
  components: DataSourcePluginComponents<TQuery>;

  constructor(datasource: DataSourceApi<TQuery>) {
    this.datasource = datasource;
    this.components = {};
  }
}

export interface DataSourcePluginComponents<TQuery extends DataQuery = DataQuery> {
  queryCtrl?: any;
  configCtrl?: any;
  annotationsQueryCtrl?: any;
  variableQueryEditor?: any;
  queryEditor?: ComponentClass<QueryEditorProps<DataSourceApi, TQuery>>;
  exploreQueryField?: ComponentClass<ExploreQueryFieldProps<DataSourceApi, TQuery>>;
  exploreStartPage?: ComponentClass<ExploreStartPageProps>;
}

export interface DataSourceApi<TQuery extends DataQuery = DataQuery> {
  /**
   *  min interval range
   */
  interval?: string;

  /**
   * Imports queries from a different datasource
   */
  importQueries?(queries: TQuery[], originMeta: PluginMeta): Promise<TQuery[]>;

  /**
   * Initializes a datasource after instantiation
   */
  init?: () => void;

  /**
   * Main metrics / data query action
   */
  query(options: DataQueryOptions<TQuery>): Promise<DataQueryResponse>;

  /**
   * Test & verify datasource settings & connection details
   */
  testDatasource(): Promise<any>;

  /**
   *  Get hints for query improvements
   */
  getQueryHints?(query: TQuery, results: any[], ...rest: any): QueryHint[];

  /**
   *  Set after constructor is called by Grafana
   */
  name?: string;

  /**
   * Set after constructor call, as the data source instance is the most common thing to pass around
   * we attach the components to this instance for easy access
   */
  components?: DataSourcePluginComponents;
}

export interface ExploreDataSourceApi<TQuery extends DataQuery = DataQuery> extends DataSourceApi {
  modifyQuery?(query: TQuery, action: QueryFixAction): TQuery;
  getHighlighterExpression?(query: TQuery): string;
  languageProvider?: any;
}

export interface QueryEditorProps<DSType extends DataSourceApi, TQuery extends DataQuery> {
  datasource: DSType;
  query: TQuery;
  onRunQuery: () => void;
  onChange: (value: TQuery) => void;
}

export enum DatasourceStatus {
  Connected,
  Disconnected,
}

export interface ExploreQueryFieldProps<DSType extends DataSourceApi, TQuery extends DataQuery> {
  datasource: DSType;
  datasourceStatus: DatasourceStatus;
  query: TQuery;
  error?: string | JSX.Element;
  hint?: QueryHint;
  history: any[];
  onExecuteQuery?: () => void;
  onQueryChange?: (value: TQuery) => void;
  onExecuteHint?: (action: QueryFixAction) => void;
}

export interface ExploreStartPageProps {
  onClickExample: (query: DataQuery) => void;
}

/**
 * Starting in v6.2 SeriesData can represent both TimeSeries and TableData
 */
export type LegacyResponseData = TimeSeries | TableData | any;

export type DataQueryResponseData = SeriesData | LegacyResponseData;

export interface DataQueryResponse {
  data: DataQueryResponseData[];
}

export interface DataQuery {
  /**
   * A - Z
   */
  refId: string;

  /**
   * true if query is disabled (ie not executed / sent to TSDB)
   */
  hide?: boolean;

  /**
   * Unique, guid like, string used in explore mode
   */
  key?: string;

  /**
   * For mixed data sources the selected datasource is on the query level.
   * For non mixed scenarios this is undefined.
   */
  datasource?: string | null;
}

export interface DataQueryError {
  data?: {
    message?: string;
    error?: string;
  };
  message?: string;
  status?: string;
  statusText?: string;
}

export interface ScopedVar {
  text: any;
  value: any;
  [key: string]: any;
}

export interface ScopedVars {
  [key: string]: ScopedVar;
}

export interface DataQueryOptions<TQuery extends DataQuery = DataQuery> {
  timezone: string;
  range: TimeRange;
  rangeRaw: RawTimeRange;
  targets: TQuery[];
  panelId: number;
  dashboardId: number;
  cacheTimeout?: string;
  interval: string;
  intervalMs: number;
  maxDataPoints: number;
  scopedVars: ScopedVars;
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
