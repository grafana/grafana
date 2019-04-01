import { ComponentClass } from 'react';
import { ReactPanelPlugin } from './panel';
import { DataQueryOptions, DataQuery, DataQueryResponse, QueryHint, QueryFixAction } from './datasource';

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
  meta?: PluginMeta;
  pluginExports?: PluginExports;
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

export interface PluginExports {
  Datasource?: DataSourceApi;
  QueryCtrl?: any;
  QueryEditor?: ComponentClass<QueryEditorProps<DataSourceApi, DataQuery>>;
  ConfigCtrl?: any;
  AnnotationsQueryCtrl?: any;
  VariableQueryEditor?: any;
  ExploreQueryField?: ComponentClass<ExploreQueryFieldProps<DataSourceApi, DataQuery>>;
  ExploreStartPage?: ComponentClass<ExploreStartPageProps>;

  // Panel plugin
  PanelCtrl?: any;
  reactPanel?: ReactPanelPlugin;
}

export interface PluginMeta {
  id: string;
  name: string;
  info: PluginMetaInfo;
  includes: PluginInclude[];

  // Datasource-specific
  builtIn?: boolean;
  metrics?: boolean;
  tables?: boolean;
  logs?: boolean;
  explore?: boolean;
  annotations?: boolean;
  mixed?: boolean;
  hasQueryHelp?: boolean;
  queryOptions?: PluginMetaQueryOptions;
}

interface PluginMetaQueryOptions {
  cacheTimeout?: boolean;
  maxDataPoints?: boolean;
  minInterval?: boolean;
}

export interface PluginInclude {
  type: string;
  name: string;
  path: string;
}

interface PluginMetaInfoLink {
  name: string;
  url: string;
}

export interface PluginMetaInfo {
  author: {
    name: string;
    url?: string;
  };
  description: string;
  links: PluginMetaInfoLink[];
  logos: {
    large: string;
    small: string;
  };
  screenshots: any[];
  updated: string;
  version: string;
}
