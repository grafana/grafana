import { Observable } from 'rxjs';
import { ComponentType } from 'react';
import { GrafanaPlugin, PluginMeta } from './plugin';
import { PanelData } from './panel';
import { LogRowModel } from './logs';
import { AnnotationEvent, AnnotationSupport } from './annotations';
import { KeyValue, LoadingState, TableData, TimeSeries, DataTopic } from './data';
import { DataFrame, DataFrameDTO } from './dataFrame';
import { RawTimeRange, TimeRange } from './time';
import { ScopedVars } from './ScopedVars';
import { CoreApp } from './app';
import { LiveChannelSupport } from './live';

export interface DataSourcePluginOptionsEditorProps<JSONData = DataSourceJsonData, SecureJSONData = {}> {
  options: DataSourceSettings<JSONData, SecureJSONData>;
  onOptionsChange: (options: DataSourceSettings<JSONData, SecureJSONData>) => void;
}

// Utility type to extract the query type TQuery from a class extending DataSourceApi<TQuery, TOptions>
export type DataSourceQueryType<DSType> = DSType extends DataSourceApi<infer TQuery, any> ? TQuery : never;

// Utility type to extract the options type TOptions from a class extending DataSourceApi<TQuery, TOptions>
export type DataSourceOptionsType<DSType> = DSType extends DataSourceApi<any, infer TOptions> ? TOptions : never;

export class DataSourcePlugin<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>,
  TSecureOptions = {}
> extends GrafanaPlugin<DataSourcePluginMeta<TOptions>> {
  components: DataSourcePluginComponents<DSType, TQuery, TOptions, TSecureOptions> = {};

  constructor(public DataSourceClass: DataSourceConstructor<DSType, TQuery, TOptions>) {
    super();
  }

  setConfigEditor(editor: ComponentType<DataSourcePluginOptionsEditorProps<TOptions, TSecureOptions>>) {
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

  setExploreQueryField(ExploreQueryField: ComponentType<ExploreQueryFieldProps<DSType, TQuery, TOptions>>) {
    this.components.ExploreQueryField = ExploreQueryField;
    return this;
  }

  setExploreMetricsQueryField(ExploreQueryField: ComponentType<ExploreQueryFieldProps<DSType, TQuery, TOptions>>) {
    this.components.ExploreMetricsQueryField = ExploreQueryField;
    return this;
  }

  setExploreLogsQueryField(ExploreQueryField: ComponentType<ExploreQueryFieldProps<DSType, TQuery, TOptions>>) {
    this.components.ExploreLogsQueryField = ExploreQueryField;
    return this;
  }

  setExploreStartPage(ExploreStartPage: ComponentType<ExploreStartPageProps>) {
    this.components.ExploreStartPage = ExploreStartPage;
    return this;
  }

  setVariableQueryEditor(VariableQueryEditor: any) {
    this.components.VariableQueryEditor = VariableQueryEditor;
    return this;
  }

  setMetadataInspector(MetadataInspector: ComponentType<MetadataInspectorProps<DSType, TQuery, TOptions>>) {
    this.components.MetadataInspector = MetadataInspector;
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

export interface DataSourcePluginMeta<T extends KeyValue = {}> extends PluginMeta<T> {
  builtIn?: boolean; // Is this for all
  metrics?: boolean;
  logs?: boolean;
  annotations?: boolean;
  alerting?: boolean;
  tracing?: boolean;
  mixed?: boolean;
  hasQueryHelp?: boolean;
  category?: string;
  queryOptions?: PluginMetaQueryOptions;
  sort?: number;
  streaming?: boolean;
}

interface PluginMetaQueryOptions {
  cacheTimeout?: boolean;
  maxDataPoints?: boolean;
  minInterval?: boolean;
}

export interface DataSourcePluginComponents<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  TSecureOptions = {}
> {
  QueryCtrl?: any;
  AnnotationsQueryCtrl?: any;
  VariableQueryEditor?: any;
  QueryEditor?: ComponentType<QueryEditorProps<DSType, TQuery, TOptions>>;
  ExploreQueryField?: ComponentType<ExploreQueryFieldProps<DSType, TQuery, TOptions>>;
  ExploreMetricsQueryField?: ComponentType<ExploreQueryFieldProps<DSType, TQuery, TOptions>>;
  ExploreLogsQueryField?: ComponentType<ExploreQueryFieldProps<DSType, TQuery, TOptions>>;
  ExploreStartPage?: ComponentType<ExploreStartPageProps>;
  ConfigEditor?: ComponentType<DataSourcePluginOptionsEditorProps<TOptions, TSecureOptions>>;
  MetadataInspector?: ComponentType<MetadataInspectorProps<DSType, TQuery, TOptions>>;
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
    this.meta = {} as DataSourcePluginMeta;
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
   * Query for data, and optionally stream results
   */
  abstract query(request: DataQueryRequest<TQuery>): Promise<DataQueryResponse> | Observable<DataQueryResponse>;

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
  meta: DataSourcePluginMeta;

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

  getVersion?(optionalOptions?: any): Promise<string>;

  showContextToggle?(row?: LogRowModel): boolean;

  interpolateVariablesInQueries?(queries: TQuery[], scopedVars: ScopedVars | {}): TQuery[];

  /**
   * An annotation processor allows explict control for how annotations are managed.
   *
   * It is only necessary to configure an annotation processor if the default behavior is not desirable
   */
  annotations?: AnnotationSupport<TQuery>;

  /**
   * Can be optionally implemented to allow datasource to be a source of annotations for dashboard.
   * This function will only be called if an angular {@link AnnotationsQueryCtrl} is configured and
   * the {@link annotations} is undefined
   *
   * @deprecated -- prefer using {@link AnnotationSupport}
   */
  annotationQuery?(options: AnnotationQueryRequest<TQuery>): Promise<AnnotationEvent[]>;

  /**
   * Define live streaming behavior within this datasource settings
   *
   * Note: `plugin.json` must also define `live: true`
   *
   * @experimental
   */
  channelSupport?: LiveChannelSupport;
}

export interface MetadataInspectorProps<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> {
  datasource: DSType;

  // All Data from this DataSource
  data: DataFrame[];
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
  onBlur?: () => void;
  /**
   * Contains query response filtered by refId of QueryResultBase and possible query error
   */
  data?: PanelData;
  range?: TimeRange;
  exploreId?: any;
  history?: HistoryItem[];
}

export enum DataSourceStatus {
  Connected,
  Disconnected,
}

// TODO: not really needed but used as type in some data sources and in DataQueryRequest
export enum ExploreMode {
  Logs = 'Logs',
  Metrics = 'Metrics',
  Tracing = 'Tracing',
}

export interface ExploreQueryFieldProps<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends QueryEditorProps<DSType, TQuery, TOptions> {
  history: any[];
  onBlur?: () => void;
  exploreId?: any;
}

export interface ExploreStartPageProps {
  datasource: DataSourceApi;
  onClickExample: (query: DataQuery) => void;
  exploreId?: any;
}

/**
 * Starting in v6.2 DataFrame can represent both TimeSeries and TableData
 */
export type LegacyResponseData = TimeSeries | TableData | any;

export type DataQueryResponseData = DataFrame | DataFrameDTO | LegacyResponseData;

export interface DataQueryResponse {
  /**
   * The response data.  When streaming, this may be empty
   * or a partial result set
   */
  data: DataQueryResponseData[];

  /**
   * When returning multiple partial responses or streams
   * Use this key to inform Grafana how to combine the partial responses
   * Multiple responses with same key are replaced (latest used)
   */
  key?: string;

  /**
   * Optionally include error info along with the response data
   */
  error?: DataQueryError;

  /**
   * Use this to control which state the response should have
   * Defaults to LoadingState.Done if state is not defined
   */
  state?: LoadingState;
}

/**
 * These are the common properties available to all queries in all datasources
 * Specific implementations will extend this interface adding the required properties
 * for the given context
 */
export interface DataQuery {
  /**
   * A - Z
   */
  refId: string;

  /**
   * true if query is disabled (ie should not be returned to the dashboard)
   */
  hide?: boolean;

  /**
   * Unique, guid like, string used in explore mode
   */
  key?: string;

  /**
   * Specify the query flavor
   */
  queryType?: string;

  /**
   * The data topic resuls should be attached to
   */
  dataTopic?: DataTopic;

  /**
   * For mixed data sources the selected datasource is on the query level.
   * For non mixed scenarios this is undefined.
   */
  datasource?: string | null;
}

export enum DataQueryErrorType {
  Cancelled = 'cancelled',
  Timeout = 'timeout',
  Unknown = 'unknown',
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
  type?: DataQueryErrorType;
}

export interface DataQueryRequest<TQuery extends DataQuery = DataQuery> {
  requestId: string; // Used to identify results and optionally cancel the request in backendSrv

  interval: string;
  intervalMs: number;
  maxDataPoints?: number;
  range: TimeRange;
  reverse?: boolean;
  scopedVars: ScopedVars;
  targets: TQuery[];
  timezone: string;
  app: CoreApp | string;

  cacheTimeout?: string;
  exploreMode?: ExploreMode;
  rangeRaw?: RawTimeRange;
  timeInfo?: string; // The query time description (blue text in the upper right)
  panelId?: number;
  dashboardId?: number;

  // Request Timing
  startTime: number;
  endTime?: number;

  // Explore state used by various datasources
  liveStreaming?: boolean;
  /**
   * @deprecated showingGraph and showingTable are always set to true
   */
  showingGraph?: boolean;
  showingTable?: boolean;
}

export interface DataQueryTimings {
  dataProcessingTime: number;
}

export interface QueryFix {
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
  expandable?: boolean;
}

export interface DataSourceJsonData {
  authType?: string;
  defaultRegion?: string;
  profile?: string;
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
  secureJsonFields: KeyValue<boolean>;
  readOnly: boolean;
  withCredentials: boolean;
  version?: number;
}

/**
 * Frontend settings model that is passed to Datasource constructor. This differs a bit from the model above
 * as this data model is available to every user who has access to a data source (Viewers+).  This is loaded
 * in bootData (on page load), or from: /api/frontend/settings
 */
export interface DataSourceInstanceSettings<T extends DataSourceJsonData = DataSourceJsonData> {
  id: number;
  uid: string;
  type: string;
  name: string;
  meta: DataSourcePluginMeta;
  url?: string;
  jsonData: T;
  username?: string;
  password?: string; // when access is direct, for some legacy datasources
  database?: string;

  /**
   * This is the full Authorization header if basic auth is enabled.
   * Only available here when access is Browser (direct), when access is Server (proxy)
   * The basic auth header, username & password is never exposed to browser/Frontend
   * so this will be empty then.
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

/**
 * Options passed to the datasource.annotationQuery method. See docs/plugins/developing/datasource.md
 *
 * @deprecated -- use {@link AnnotationSupport}
 */
export interface AnnotationQueryRequest<MoreOptions = {}> {
  range: TimeRange;
  rangeRaw: RawTimeRange;
  // Should be DataModel but cannot import that here from the main app. Needs to be moved to package first.
  dashboard: any;
  annotation: {
    datasource: string;
    enable: boolean;
    name: string;
  } & MoreOptions;
}

export interface HistoryItem<TQuery extends DataQuery = DataQuery> {
  ts: number;
  query: TQuery;
}

export abstract class LanguageProvider {
  abstract datasource: DataSourceApi<any, any>;
  abstract request: (url: string, params?: any) => Promise<any>;

  /**
   * Returns startTask that resolves with a task list when main syntax is loaded.
   * Task list consists of secondary promises that load more detailed language features.
   */
  abstract start: () => Promise<any[]>;
  startTask?: Promise<any[]>;
}
