import { ComponentType } from 'react';
import { Observable } from 'rxjs';
import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceJsonData,
  DefaultVariableQuery,
  MetricFindValue,
  QueryEditorProps,
} from '@grafana/data';

import {
  AdHocVariableModel,
  ConstantVariableModel,
  QueryVariableModel,
  VariableModel,
  VariableWithMultiSupport,
} from './types';

export const isQuery = (model: VariableModel): model is QueryVariableModel => {
  return model.type === 'query';
};

export const isAdHoc = (model: VariableModel): model is AdHocVariableModel => {
  return model.type === 'adhoc';
};

export const isConstant = (model: VariableModel): model is ConstantVariableModel => {
  return model.type === 'constant';
};

export const isMulti = (model: VariableModel): model is VariableWithMultiSupport => {
  const withMulti = model as VariableWithMultiSupport;
  return withMulti.hasOwnProperty('multi') && typeof withMulti.multi === 'boolean';
};

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
      editor: ComponentType<QueryEditorProps<any, TQuery, TOptions, VariableQuery>>;
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
      editor: ComponentType<QueryEditorProps<any, TQuery, TOptions, TQuery>>;
    };
  };
}

export const hasLegacyVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
>(
  datasource: DataSourceApi<TQuery, TOptions>
): datasource is DataSourceWithLegacyVariableSupport<TQuery, TOptions> => {
  return Boolean(datasource.metricFindQuery) && !Boolean(datasource.variables);
};

export const hasDefaultVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
>(
  datasource: DataSourceApi<TQuery, TOptions>
): datasource is DataSourceWithDefaultVariableSupport<TQuery, TOptions> => {
  return (
    Boolean(datasource.variables?.default) &&
    Boolean(datasource.variables?.default?.toDataQuery) &&
    !Boolean(datasource.variables?.custom) &&
    !Boolean(datasource.variables?.datasource)
  );
};

export const hasCustomVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
>(
  datasource: DataSourceApi<TQuery, TOptions>
): datasource is DataSourceWithCustomVariableSupport<TQuery, TOptions> => {
  return (
    Boolean(datasource.variables?.custom) &&
    Boolean(datasource.variables?.custom?.query) &&
    Boolean(datasource.variables?.custom?.editor) &&
    !Boolean(datasource.variables?.default) &&
    !Boolean(datasource.variables?.datasource)
  );
};

export const hasDatasourceVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
>(
  datasource: DataSourceApi<TQuery, TOptions>
): datasource is DataSourceWithDatasourceVariableSupport<TQuery, TOptions> => {
  return (
    Boolean(datasource.variables?.datasource) &&
    Boolean(datasource.variables?.datasource?.editor) &&
    !Boolean(datasource.variables?.default) &&
    !Boolean(datasource.variables?.custom)
  );
};
