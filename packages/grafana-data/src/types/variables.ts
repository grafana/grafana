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
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  VariableQuery extends DataQuery = any
> {
  default?: {
    toDataQuery: (query: VariableQuery) => TQuery;
    query?: (request: DataQueryRequest<TQuery>) => Observable<DataQueryResponse>;
  };
  custom?: {
    editor: ComponentType<VariableQueryEditorProps<DSType, TQuery, TOptions, VariableQuery>>;
    query: (request: DataQueryRequest<VariableQuery>) => Observable<DataQueryResponse>;
  };
  datasource?: {
    editor: ComponentType<VariableQueryEditorProps<DSType, TQuery, TOptions, TQuery>>;
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
      editor: ComponentType<VariableQueryEditorProps<any, TQuery, TOptions, VariableQuery>>;
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
      editor: ComponentType<VariableQueryEditorProps<any, TQuery, TOptions, TQuery>>;
    };
  };
}

export interface VariableQueryEditorProps<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  VariableQuery extends DataQuery = DataQuery
> {
  datasource: DSType;
  query: VariableQuery;
  onChange: (value: VariableQuery) => void;
}

export interface DefaultVariableQuery extends DataQuery {
  query: string;
}
