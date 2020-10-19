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

interface DataSourceWithLegacyVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends DataSourceApi<TQuery, TOptions> {
  metricFindQuery(query: any, options?: any): Promise<MetricFindValue[]>;
  variables: undefined;
}

interface DataSourceWithStandardVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends DataSourceApi<TQuery, TOptions> {
  variables: {
    standard: {
      toDataQuery: (query: DefaultVariableQuery) => TQuery;
      query?: (request: DataQueryRequest<TQuery>) => Observable<DataQueryResponse>;
    };
    custom: undefined;
    datasource: undefined;
  };
}

interface DataSourceWithCustomVariableSupport<
  VariableQuery extends DataQuery = any,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends DataSourceApi<TQuery, TOptions> {
  variables: {
    standard: undefined;
    custom: {
      editor: ComponentType<QueryEditorProps<any, TQuery, TOptions, VariableQuery>>;
      query: (request: DataQueryRequest<TQuery>) => Observable<DataQueryResponse>;
    };
    datasource: undefined;
  };
}

interface DataSourceWithDatasourceVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends DataSourceApi<TQuery, TOptions> {
  variables: {
    standard: undefined;
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
): datasource is DataSourceWithStandardVariableSupport<TQuery, TOptions> => {
  return (
    Boolean(datasource.variables?.standard) &&
    Boolean(datasource.variables?.standard?.toDataQuery) &&
    !Boolean(datasource.variables?.custom) &&
    !Boolean(datasource.variables?.datasource)
  );
};

export const hasCustomVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
>(
  datasource: DataSourceApi<TQuery, TOptions>
): datasource is DataSourceWithCustomVariableSupport<any, TQuery, TOptions> => {
  return (
    Boolean(datasource.variables?.custom) &&
    Boolean(datasource.variables?.custom?.query) &&
    Boolean(datasource.variables?.custom?.editor) &&
    !Boolean(datasource.variables?.standard) &&
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
    !Boolean(datasource.variables?.standard) &&
    !Boolean(datasource.variables?.custom)
  );
};
