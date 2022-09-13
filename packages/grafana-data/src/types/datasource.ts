import { ComponentType } from 'react';
import { Observable } from 'rxjs';

import { makeClassES5Compatible } from '../utils/makeClassES5Compatible';

import { ScopedVars } from './ScopedVars';
import { AnnotationEvent, AnnotationQuery, AnnotationSupport } from './annotations';
import { CoreApp } from './app';
import { KeyValue, LoadingState, TableData, TimeSeries } from './data';
import { DataFrame, DataFrameDTO } from './dataFrame';
import { PanelData } from './panel';
import { GrafanaPlugin, PluginMeta } from './plugin';
import { DataQuery } from './query';
import { RawTimeRange, TimeRange } from './time';
import { CustomVariableSupport, DataSourceVariableSupport, StandardVariableSupport } from './variables';

import { DataSourceRef, WithAccessControlMetadata } from '.';

export interface DataSourcePluginOptionsEditorProps<
  JSONData extends DataSourceJsonData = DataSourceJsonData,
  SecureJSONData = {}
> {
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

  /** @deprecated Use `setQueryEditor` instead. When using Explore `props.app` is equal to `CoreApp.Explore` */
  setExploreQueryField(ExploreQueryField: ComponentType<QueryEditorProps<DSType, TQuery, TOptions>>) {
    this.components.ExploreQueryField = ExploreQueryField;
    return this;
  }

  /** @deprecated Use `setQueryEditor` instead. */
  setExploreMetricsQueryField(ExploreQueryField: ComponentType<QueryEditorProps<DSType, TQuery, TOptions>>) {
    this.components.ExploreMetricsQueryField = ExploreQueryField;
    return this;
  }

  /** @deprecated Use `setQueryEditor` instead. */
  setExploreLogsQueryField(ExploreQueryField: ComponentType<QueryEditorProps<DSType, TQuery, TOptions>>) {
    this.components.ExploreLogsQueryField = ExploreQueryField;
    return this;
  }

  setQueryEditorHelp(QueryEditorHelp: ComponentType<QueryEditorHelpProps<TQuery>>) {
    this.components.QueryEditorHelp = QueryEditorHelp;
    return this;
  }

  /**
   * @deprecated prefer using `setQueryEditorHelp`
   */
  setExploreStartPage(ExploreStartPage: ComponentType<QueryEditorHelpProps<TQuery>>) {
    return this.setQueryEditorHelp(ExploreStartPage);
  }

  /**
   * @deprecated -- prefer using {@link StandardVariableSupport} or {@link CustomVariableSupport} or {@link DataSourceVariableSupport} in data source instead
   */
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
    this.components.QueryEditor = pluginExports.QueryEditor;
    this.components.QueryEditorHelp = pluginExports.QueryEditorHelp;
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
  unlicensed?: boolean;
  backend?: boolean;
  isBackend?: boolean;
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
  /** @deprecated it will be removed in a future release and `QueryEditor` will be used instead. */
  ExploreQueryField?: ComponentType<QueryEditorProps<DSType, TQuery, TOptions>>;
  /** @deprecated it will be removed in a future release and `QueryEditor` will be used instead. */
  ExploreMetricsQueryField?: ComponentType<QueryEditorProps<DSType, TQuery, TOptions>>;
  /** @deprecated it will be removed in a future release and `QueryEditor` will be used instead. */
  ExploreLogsQueryField?: ComponentType<QueryEditorProps<DSType, TQuery, TOptions>>;
  QueryEditorHelp?: ComponentType<QueryEditorHelpProps<TQuery>>;
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

// VariableSupport is hoisted up to its own type to fix the wonky intermittent
// 'variables is references directly or indirectly' error
type VariableSupport<TQuery extends DataQuery, TOptions extends DataSourceJsonData> =
  | StandardVariableSupport<DataSourceApi<TQuery, TOptions>>
  | CustomVariableSupport<DataSourceApi<TQuery, TOptions>>
  | DataSourceVariableSupport<DataSourceApi<TQuery, TOptions>>;

/**
 * The main data source abstraction interface, represents an instance of a data source
 *
 * Although this is a class, datasource implementations do not *yet* need to extend it.
 * As such, we can not yet add functions with default implementations.
 */
abstract class DataSourceApi<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  TQueryImportConfiguration extends Record<string, object> = {}
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
   *  Set in constructor
   */
  readonly type: string;

  /**
   *  Set in constructor
   */
  readonly uid: string;

  /**
   *  min interval range
   */
  interval?: string;

  constructor(instanceSettings: DataSourceInstanceSettings<TOptions>) {
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
    this.type = instanceSettings.type;
    this.meta = instanceSettings.meta;
    this.uid = instanceSettings.uid;
  }

  /**
   * @deprecated use DataSourceWithQueryImportSupport and DataSourceWithQueryExportSupport
   */
  async importQueries?(queries: DataQuery[], originDataSource: DataSourceApi<DataQuery>): Promise<TQuery[]>;

  /**
   * Returns configuration for importing queries from other data sources
   */
  getImportQueryConfiguration?(): TQueryImportConfiguration;

  /**
   * Initializes a datasource after instantiation
   */
  init?: () => void;

  /**
   * Query for data, and optionally stream results
   */
  abstract query(request: DataQueryRequest<TQuery>): Promise<DataQueryResponse> | Observable<DataQueryResponse>;

  /**
   * Test & verify datasource settings & connection details (returning TestingStatus)
   *
   * When verification fails - errors specific to the data source should be handled here and converted to
   * a TestingStatus object. Unknown errors and HTTP errors can be re-thrown and will be handled here:
   * public/app/features/datasources/state/actions.ts
   */
  abstract testDatasource(): Promise<any>;

  /**
   * Override to skip executing a query
   *
   * @returns false if the query should be skipped
   *
   * @virtual
   */
  filterQuery?(query: TQuery): boolean;

  /**
   *  Get hints for query improvements
   */
  getQueryHints?(query: TQuery, results: any[], ...rest: any): QueryHint[];

  /**
   * Convert a query to a simple text string
   */
  getQueryDisplayText?(query: TQuery): string;

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
   * @deprecated since version 8.2.0
   * Not used anymore.
   */
  getHighlighterExpression?(query: TQuery): string[];

  /** Get an identifier object for this datasource instance */
  getRef(): DataSourceRef {
    return { type: this.type, uid: this.uid };
  }

  /**
   * Used in explore
   */
  languageProvider?: any;

  getVersion?(optionalOptions?: any): Promise<string>;

  interpolateVariablesInQueries?(queries: TQuery[], scopedVars: ScopedVars | {}): TQuery[];

  /**
   * An annotation processor allows explicit control for how annotations are managed.
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
   * Defines new variable support
   * @alpha -- experimental
   */
  variables?: VariableSupport<TQuery, TOptions>;

  /*
   * Optionally, use this method to set default values for a query
   * @alpha -- experimental
   */
  getDefaultQuery?(app: CoreApp): Partial<TQuery>;
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
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  TVQuery extends DataQuery = TQuery
> {
  datasource: DSType;
  query: TVQuery;
  onRunQuery: () => void;
  onChange: (value: TVQuery) => void;
  onBlur?: () => void;
  /**
   * Contains query response filtered by refId of QueryResultBase and possible query error
   */
  data?: PanelData;
  range?: TimeRange;
  exploreId?: any;
  history?: Array<HistoryItem<TQuery>>;
  queries?: DataQuery[];
  app?: CoreApp;
}

// TODO: not really needed but used as type in some data sources and in DataQueryRequest
export enum ExploreMode {
  Logs = 'Logs',
  Metrics = 'Metrics',
  Tracing = 'Tracing',
}

/**
 * @deprecated use QueryEditorProps instead
 */
export type ExploreQueryFieldProps<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> = QueryEditorProps<DSType, TQuery, TOptions>;

export interface QueryEditorHelpProps<TQuery extends DataQuery = DataQuery> {
  datasource: DataSourceApi<TQuery>;
  query: TQuery;
  onClickExample: (query: TQuery) => void;
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

export enum DataQueryErrorType {
  Cancelled = 'cancelled',
  Timeout = 'timeout',
  Unknown = 'unknown',
}

export interface DataQueryError {
  data?: {
    /**
     * Short information about the error
     */
    message?: string;
    /**
     * Detailed information about the error. Only returned when app_mode is development.
     */
    error?: string;
  };
  message?: string;
  status?: number;
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
  scopedVars: ScopedVars;
  targets: TQuery[];
  timezone: string;
  app: CoreApp | string;

  cacheTimeout?: string | null;
  rangeRaw?: RawTimeRange;
  timeInfo?: string; // The query time description (blue text in the upper right)
  panelId?: number;
  /** @deprecate */
  dashboardId?: number;
  dashboardUID?: string;
  publicDashboardAccessToken?: string;

  // Request Timing
  startTime: number;
  endTime?: number;

  // Explore state used by various datasources
  liveStreaming?: boolean;
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
  options?: KeyValue<string>;
}

export interface QueryHint {
  type: string;
  label: string;
  fix?: QueryFix;
}

export interface MetricFindValue {
  text: string;
  value?: string | number;
  expandable?: boolean;
}

export interface DataSourceJsonData {
  authType?: string;
  defaultRegion?: string;
  profile?: string;
  manageAlerts?: boolean;
  alertmanagerUid?: string;
}

/**
 * Data Source instance edit model.  This is returned from:
 *  /api/datasources
 */
export interface DataSourceSettings<T extends DataSourceJsonData = DataSourceJsonData, S = {}>
  extends WithAccessControlMetadata {
  id: number;
  uid: string;
  orgId: number;
  name: string;
  typeLogoUrl: string;
  type: string;
  typeName: string;
  access: string;
  url: string;
  user: string;
  database: string;
  basicAuth: boolean;
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
  readOnly: boolean;
  url?: string;
  jsonData: T;
  username?: string;
  password?: string; // when access is direct, for some legacy datasources
  database?: string;
  isDefault?: boolean;
  access: 'direct' | 'proxy'; // Currently we support 2 options - direct (browser) and proxy (server)

  /**
   * This is the full Authorization header if basic auth is enabled.
   * Only available here when access is Browser (direct), when access is Server (proxy)
   * The basic auth header, username & password is never exposed to browser/Frontend
   * so this will be empty then.
   */
  basicAuth?: string;
  withCredentials?: boolean;

  /** When the name+uid are based on template variables, maintain access to the real values */
  rawRef?: DataSourceRef;
}

/**
 * @deprecated -- use {@link DataSourceInstanceSettings} instead
 */
export interface DataSourceSelectItem {
  name: string;
  value: string | null;
  meta: DataSourcePluginMeta;
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
  annotation: AnnotationQuery;
}

export interface HistoryItem<TQuery extends DataQuery = DataQuery> {
  ts: number;
  query: TQuery;
}

abstract class LanguageProvider {
  abstract datasource: DataSourceApi<any, any>;
  abstract request: (url: string, params?: any) => Promise<any>;

  /**
   * Returns startTask that resolves with a task list when main syntax is loaded.
   * Task list consists of secondary promises that load more detailed language features.
   */
  abstract start: () => Promise<Array<Promise<any>>>;
  startTask?: Promise<any[]>;
}

//@ts-ignore
LanguageProvider = makeClassES5Compatible(LanguageProvider);
export { LanguageProvider };

//@ts-ignore
DataSourceApi = makeClassES5Compatible(DataSourceApi);

export { DataSourceApi };
