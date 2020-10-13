import {
  AdHocVariableModel,
  ConstantVariableModel,
  QueryVariableModel,
  VariableModel,
  VariableWithMultiSupport,
} from './types';
import {
  DataQuery,
  DataSourceApi,
  DataSourceJsonData,
  DataSourceWithCustomVariableSupport,
  DataSourceWithDatasourceVariableSupport,
  DataSourceWithDefaultVariableSupport,
  DataSourceWithLegacyVariableSupport,
} from '@grafana/data';

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
    !Boolean(datasource.variables?.default) &&
    !Boolean(datasource.variables?.custom)
  );
};
