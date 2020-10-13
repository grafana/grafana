import { ComponentType } from 'react';
import { Observable } from 'rxjs';

import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceJsonData,
  MetricFindValue,
} from './datasource';

export interface VariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  VariableQuery extends DataQuery = any
> {
  default?: {
    toDataQuery: (query: VariableQuery) => TQuery;
    query?: (request: DataQueryRequest<TQuery>) => Observable<DataQueryResponse>;
  };
  custom?: {
    toDataQuery: (query: VariableQuery) => TQuery;
    editor: ComponentType<VariableQueryEditorProps<TQuery, TOptions, VariableQuery>>;
    query: (request: DataQueryRequest<TQuery>) => Observable<DataQueryResponse>;
  };
  datasource?: {
    editor: ComponentType<VariableQueryEditorProps<TQuery, TOptions, TQuery>>;
  };
}

export interface DataSourceWithLegacyVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends DataSourceApi<TQuery, TOptions> {
  metricFindQuery(query: any, options?: any): Promise<MetricFindValue[]>;
  variables: undefined;
}

export interface DataSourceWithDefaultVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends DataSourceApi<TQuery, TOptions> {
  variables: {
    default: {
      toDataQuery: (query: DefaultVariableQuery) => TQuery;
      query?: (request: DataQueryRequest<TQuery>) => Observable<DataQueryResponse>;
    };
    custom: undefined;
    datasource: undefined;
  };
}

export interface DataSourceWithCustomVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  VariableQuery extends DataQuery = any
> extends DataSourceApi<TQuery, TOptions> {
  variables: {
    default: undefined;
    custom: {
      toDataQuery: (query: VariableQuery) => TQuery;
      editor: ComponentType<VariableQueryEditorProps<TQuery, TOptions, VariableQuery>>;
      query: (request: DataQueryRequest<TQuery>) => Observable<DataQueryResponse>;
    };
    datasource: undefined;
  };
}

export interface DataSourceWithDatasourceVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends DataSourceApi<TQuery, TOptions> {
  variables: {
    default: undefined;
    custom: undefined;
    datasource: {
      editor: ComponentType<VariableQueryEditorProps<TQuery, TOptions, TQuery>>;
    };
  };
}

export interface VariableQueryEditorProps<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  VariableQuery extends DataQuery = DataQuery
> {
  datasource: DataSourceApi<TQuery, TOptions>;
  query: VariableQuery;
  onChange: (value: VariableQuery) => void;
}

export interface DefaultVariableQueryEditorProps<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends VariableQueryEditorProps<TQuery, TOptions, DefaultVariableQuery> {}

export interface CustomVariableQueryEditorProps<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  VariableQuery extends DataQuery = DataQuery
> extends VariableQueryEditorProps<TQuery, TOptions, VariableQuery> {}

export interface DatasourceVariableQueryEditorProps<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends VariableQueryEditorProps<TQuery, TOptions, TQuery> {}

export interface DefaultVariableQuery extends DataQuery {
  query: string;
}
