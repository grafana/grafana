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
  VariableQuery extends DataQuery = DataQuery
> {
  default?: DefaultVariableSupportType<TQuery, TOptions>;
  custom?: CustomVariableSupportType<TQuery, TOptions, VariableQuery>;
  datasource?: DatasourceVariableSupportType<TQuery, TOptions>;
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
      editor: ComponentType<VariableQueryEditorProps<TQuery, TOptions, DefaultVariableQuery>>;
      query: (request: DataQueryRequest<TQuery>) => Observable<DataQueryResponse>;
    };
    custom: undefined;
    datasource: undefined;
  };
}

export interface DataSourceWithCustomVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends DataSourceApi<TQuery, TOptions> {
  variables: {
    default: undefined;
    custom: {
      toDataQuery: (query: any) => TQuery;
      editor: ComponentType<VariableQueryEditorProps<TQuery, TOptions, any>>;
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
      toDataQuery: undefined;
      editor: ComponentType<VariableQueryEditorProps<TQuery, TOptions, TQuery>>;
      query: undefined;
    };
  };
}

export interface VariableSupportType<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  VariableQuery extends DataQuery = DataQuery
> {
  toDataQuery?: (query: VariableQuery) => TQuery;
  editor?: ComponentType<VariableQueryEditorProps<TQuery, TOptions, VariableQuery>>;
  query?: (request: DataQueryRequest<TQuery>) => Observable<DataQueryResponse>;
}

export interface DefaultVariableSupportType<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends VariableSupportType<TQuery, TOptions, DefaultVariableQuery> {}

export interface CustomVariableSupportType<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  VariableQuery extends DataQuery = DataQuery
> extends VariableSupportType<TQuery, TOptions> {}

export interface DatasourceVariableSupportType<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends VariableSupportType<TQuery, TOptions, TQuery> {}

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
