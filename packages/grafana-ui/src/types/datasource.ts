import { ComponentType, ComponentClass } from 'react';
import {
  TimeRange,
  RawTimeRange,
  TableData,
  TimeSeries,
  DataFrame,
  LogRowModel,
  LoadingState,
  DataFrameDTO,
} from '@grafana/data';
import { PluginMeta, GrafanaPlugin } from './plugin';
import { PanelData } from './panel';

// NOTE: this seems more general than just DataSource
export interface DataSourcePluginOptionsEditorProps<TOptions> {
  options: TOptions;
  onOptionsChange: (options: TOptions) => void;
}

export class DataSourcePlugin<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends GrafanaPlugin<DataSourcePluginMeta> {
  DataSourceClass: DataSourceConstructor<DSType, TQuery, TOptions>;
  components: DataSourcePluginComponents<DSType, TQuery, TOptions>;

  constructor(DataSourceClass: DataSourceConstructor<DSType, TQuery, TOptions>) {
    super();
    this.DataSourceClass = DataSourceClass;
    this.components = {};
  }

  setConfigEditor(editor: ComponentType<DataSourcePluginOptionsEditorProps<DataSourceSettings<TOptions>>>) {
    this.components.ConfigEditor = editor;
    return this;
  }

  setConfigCtrl(ConfigCtrl: any) {
    this.angularConfigCtrl = ConfigCtrl;
    return this;
  }

  setQueryCtrl(QueryCtrl: any) {
    this.components.QueryCtrl = QueryCtrl;
    return this;
  }

  setAnnotationQueryCtrl(AnnotationsQueryCtrl: any) {
    this.components.AnnotationsQueryCtrl = AnnotationsQueryCtrl;
    return this;
  }

  setQueryEditor(QueryEditor: ComponentType<QueryEditorProps<DSType, TQuery, TOptions>>) {
    this.components.QueryEditor = QueryEditor;
    return this;
  }

  setExploreQueryField(ExploreQueryField: ComponentClass<ExploreQueryFieldProps<DSType, TQuery, TOptions>>) {
    this.components.ExploreQueryField = ExploreQueryField;
    return this;
  }

  setExploreMetricsQueryField(ExploreQueryField: ComponentClass<ExploreQueryFieldProps<DSType, TQuery, TOptions>>) {
    this.components.ExploreMetricsQueryField = ExploreQueryField;
    return this;
  }

  setExploreLogsQueryField(ExploreQueryField: ComponentClass<ExploreQueryFieldProps<DSType, TQuery, TOptions>>) {
    this.components.ExploreLogsQueryField = ExploreQueryField;
    return this;
  }

  setExploreStartPage(ExploreStartPage: ComponentClass<ExploreStartPageProps>) {
    this.components.ExploreStartPage = ExploreStartPage;
    return this;
  }

  setVariableQueryEditor(VariableQueryEditor: any) {
    this.components.VariableQueryEditor = VariableQueryEditor;
    return this;
  }

  setComponentsFromLegacyExports(pluginExports: any) {
    this.angularConfigCtrl = pluginExports.ConfigCtrl;

    this.components.QueryCtrl = pluginExports.QueryCtrl;
    this.components.AnnotationsQueryCtrl = pluginExports.AnnotationsQueryCtrl;
    this.components.ExploreQueryField = pluginExports.ExploreQueryField;
    this.components.ExploreStartPage = pluginExports.ExploreStartPage;
    this.components.QueryEditor = pluginExports.QueryEditor;
    this.components.VariableQueryEditor = pluginExports.VariableQueryEditor;
  }
}

export interface DataSourcePluginMeta extends PluginMeta {
  builtIn?: boolean; // Is this for all
  metrics?: boolean;
  logs?: boolean;
  annotations?: boolean;
  alerting?: boolean;
  mixed?: boolean;
  hasQueryHelp?: boolean;
  category?: string;
  queryOptions?: PluginMetaQueryOptions;
  sort?: number;
  streaming?: boolean;

  /**
   * By default, hidden queries are not passed to the datasource
   * Set this to true in plugin.json to have hidden queries passed to the
   * DataSource query method
   */
  hiddenQueries?: boolean;
}

interface PluginMetaQueryOptions {
  cacheTimeout?: boolean;
  maxDataPoints?: boolean;
  minInterval?: boolean;
}

export interface DataSourcePluginComponents<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> {
  QueryCtrl?: any;
  AnnotationsQueryCtrl?: any;
  VariableQueryEditor?: any;
  QueryEditor?: ComponentType<QueryEditorProps<DSType, TQuery, TOptions>>;
  ExploreQueryField?: ComponentClass<ExploreQueryFieldProps<DSType, TQuery, TOptions>>;
  ExploreMetricsQueryField?: ComponentClass<ExploreQueryFieldProps<DSType, TQuery, TOptions>>;
  ExploreLogsQueryField?: ComponentClass<ExploreQueryFieldProps<DSType, TQuery, TOptions>>;
  ExploreStartPage?: ComponentClass<ExploreStartPageProps>;
  ConfigEditor?: ComponentType<DataSourcePluginOptionsEditorProps<DataSourceSettings<TOptions>>>;
}

// Only exported for tests
export interface DataSourceConstructor<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> {
  new (instanceSettings: DataSourceInstanceSettings<TOptions>, ...args: any[]): DSType;
}

/**
 * The main data source abstraction interface, represents an instance of a data source
 *
 * Although this is a class, datasource implementations do not *yet* need to extend it.
 * As such, we can not yet add functions with default implementations.
 */
export abstract class DataSourceApi<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> {
  /**
   *  Set in constructor
   */
  readonly name: string;

  /**
   *  Set in constructor
   */
  readonly id: number;

  /**
   *  min interval range
   */
  interval?: string;

  constructor(instanceSettings: DataSourceInstanceSettings<TOptions>) {
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
  }

  /**
   * Imports queries from a different datasource
   */
  importQueries?(queries: TQuery[], originMeta: PluginMeta): Promise<TQuery[]>;

  /**
   * Initializes a datasource after instantiation
   */
  init?: () => void;

  /**
   * Query for data, and optionally stream results to an observer.
   *
   * Are you reading these docs aiming to execute a query?
   * +-> If Yes, then consider using panelQueryRunner/State instead.  see:
   *  * {@link https://github.com/grafana/grafana/blob/master/public/app/features/dashboard/state/PanelQueryRunner.ts PanelQueryRunner.ts}
   *  * {@link https://github.com/grafana/grafana/blob/master/public/app/features/dashboard/state/PanelQueryState.ts PanelQueryState.ts}
   *
   * If you are implementing a simple request-response query,
   * then you can ignore the `observer` entirely.
   *
   * When streaming behavior is required, the Promise can return at any time
   * with empty or partial data in the response and optionally a state.
   * NOTE: The data in this initial response will not be replaced with any
   * data from subsequent events. {@see DataStreamState}
   *
   * The request object will be passed in each observer callback
   * so the callback could assert that the correct events are streaming and
   * unsubscribe if unexpected results are returned.
   */
  abstract query(request: DataQueryRequest<TQuery>, observer?: DataStreamObserver): Promise<DataQueryResponse>;

  /**
   * Test & verify datasource settings & connection details
   */
  abstract testDatasource(): Promise<any>;

  /**
   *  Get hints for query improvements
   */
  getQueryHints?(query: TQuery, results: any[], ...rest: any): QueryHint[];

  /**
   * Convert a query to a simple text string
   */
  getQueryDisplayText?(query: TQuery): string;

  /**
   * Retrieve context for a given log row
   */
  getLogRowContext?: <TContextQueryOptions extends {}>(
    row: LogRowModel,
    options?: TContextQueryOptions
  ) => Promise<DataQueryResponse>;

  /**
   * Variable query action.
   */
  metricFindQuery?(query: any, options?: any): Promise<MetricFindValue[]>;

  /**
   * Get tag keys for adhoc filters
   */
  getTagKeys?(options?: any): Promise<MetricFindValue[]>;

  /**
   * Get tag values for adhoc filters
   */
  getTagValues?(options: any): Promise<MetricFindValue[]>;

  /**
   * Set after constructor call, as the data source instance is the most common thing to pass around
   * we attach the components to this instance for easy access
   */
  components?: DataSourcePluginComponents<DataSourceApi<TQuery, TOptions>, TQuery, TOptions>;

  /**
   * static information about the datasource
   */
  meta?: DataSourcePluginMeta;

  /**
   * Used by alerting to check if query contains template variables
   */
  targetContainsTemplate?(query: TQuery): boolean;

  /**
   * Used in explore
   */
  modifyQuery?(query: TQuery, action: QueryFixAction): TQuery;

  /**
   * Used in explore
   */
  getHighlighterExpression?(query: TQuery): string[];

  /**
   * Used in explore
   */
  languageProvider?: any;
}

export interface QueryEditorProps<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> {
  datasource: DSType;
  query: TQuery;
  onRunQuery: () => void;
  onChange: (value: TQuery) => void;
  panelData: PanelData; // The current panel data
  queryResponse?: PanelData; // data filtered to only this query.  Includes the error.
}

export enum DataSourceStatus {
  Connected,
  Disconnected,
}

export interface ExploreQueryFieldProps<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends QueryEditorProps<DSType, TQuery, TOptions> {
  datasourceStatus: DataSourceStatus;
  history: any[];
  onHint?: (action: QueryFixAction) => void;
}

export interface ExploreStartPageProps {
  onClickExample: (query: DataQuery) => void;
}

/**
 * Starting in v6.2 DataFrame can represent both TimeSeries and TableData
 */
export type LegacyResponseData = TimeSeries | TableData | any;

export type DataQueryResponseData = DataFrame | DataFrameDTO | LegacyResponseData;

export type DataStreamObserver = (event: DataStreamState) => void;

export interface DataStreamState {
  /**
   * when Done or Error no more events will be processed
   */
  state: LoadingState;

  /**
   * The key is used to identify unique sets of data within
   * a response, and join or replace them before sending them to the panel.
   *
   * For example consider a query that streams four DataFrames (A,B,C,D)
   * and multiple events with keys K1, and K2
   *
   * query(...) returns: {
   *   state:Streaming
   *   data:[A]
   * }
   *
   * Events:
   * 1. {key:K1, data:[B1]}    >> PanelData: [A,B1]
   * 2. {key:K2, data:[C2,D2]} >> PanelData: [A,B1,C2,D2]
   * 3. {key:K1, data:[B3]}    >> PanelData: [A,B3,C2,D2]
   * 4. {key:K2, data:[C4]}    >> PanelData: [A,B3,C4]
   *
   * NOTE: that PanelData will not report a `Done` state until all
   * unique keys have returned with either `Error` or `Done` state.
   */
  key: string;

  /**
   * The stream request.  The properties of this request will be examined
   * to determine if the stream matches the original query.  If not, it
   * will be unsubscribed.
   */
  request: DataQueryRequest;

  /**
   * The streaming events return entire DataFrames.  The DataSource
   * sending the events is responsible for truncating any growing lists
   * most likely to the requested `maxDataPoints`
   */
  data?: DataFrame[];

  /**
   * Error in stream (but may still be running)
   */
  error?: DataQueryError;

  /**
   * @deprecated: DO NOT USE IN ANYTHING NEW!!!!
   *
   * merging streaming rows should be handled in the DataSource
   * and/or we should add metadata to this state event that
   * indicates that the PanelQueryRunner should manage the row
   * additions.
   */
  delta?: DataFrame[];

  /**
   * Stop listening to this stream
   */
  unsubscribe: () => void;
}

export interface DataQueryResponse {
  /**
   * The response data.  When streaming, this may be empty
   * or a partial result set
   */
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

  metric?: any;
}

export interface DataQueryError {
  data?: {
    message?: string;
    error?: string;
  };
  message?: string;
  status?: string;
  statusText?: string;
  refId?: string;
}

export interface ScopedVar {
  text: any;
  value: any;
  [key: string]: any;
}

export interface ScopedVars {
  [key: string]: ScopedVar;
}

export interface DataQueryRequest<TQuery extends DataQuery = DataQuery> {
  requestId: string; // Used to identify results and optionally cancel the request in backendSrv
  timezone: string;
  range: TimeRange;
  rangeRaw?: RawTimeRange;
  timeInfo?: string; // The query time description (blue text in the upper right)
  targets: TQuery[];
  panelId: number;
  dashboardId: number;
  cacheTimeout?: string;
  interval: string;
  intervalMs: number;
  maxDataPoints: number;
  scopedVars: ScopedVars;

  // Request Timing
  startTime: number;
  endTime?: number;
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

export interface MetricFindValue {
  text: string;
}

export interface DataSourceJsonData {
  authType?: string;
  defaultRegion?: string;
}

/**
 * Data Source instance edit model.  This is returned from:
 *  /api/datasources
 */
export interface DataSourceSettings<T extends DataSourceJsonData = DataSourceJsonData, S = {}> {
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
  jsonData: T;
  secureJsonData?: S;
  readOnly: boolean;
  withCredentials: boolean;
}

/**
 * Frontend settings model that is passed to Datasource constructor. This differs a bit from the model above
 * as this data model is available to every user who has access to a data source (Viewers+).  This is loaded
 * in bootData (on page load), or from: /api/frontend/settings
 */
export interface DataSourceInstanceSettings<T extends DataSourceJsonData = DataSourceJsonData> {
  id: number;
  type: string;
  name: string;
  meta: DataSourcePluginMeta;
  url?: string;
  jsonData: T;
  username?: string;
  password?: string; // when access is direct, for some legacy datasources
  database?: string;

  /**
   * This is the full Authorization header if basic auth is ennabled.
   * Only available here when access is Browser (direct), when acess is Server (proxy)
   * The basic auth header, username & password is never exposted to browser/Frontend
   * so this will be emtpy then.
   */
  basicAuth?: string;
  withCredentials?: boolean;
}

export interface DataSourceSelectItem {
  name: string;
  value: string | null;
  meta: DataSourcePluginMeta;
  sort: string;
}
