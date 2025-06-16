import { ComponentType } from 'react';
import { Observable } from 'rxjs';

import {
  AdHocVariableModel,
  ConstantVariableModel,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceJsonData,
  DataSourceRef,
  LegacyMetricFindQueryOptions,
  MetricFindValue,
  QueryVariableModel,
  StandardVariableQuery,
  VariableModel,
  VariableSupportType,
  VariableWithMultiSupport,
  VariableWithOptions,
} from '@grafana/data';

import { LEGACY_VARIABLE_QUERY_EDITOR_NAME } from './editor/LegacyVariableQueryEditor';
import { VariableQueryEditorType, VariableQueryEditorProps } from './types';

/** @deprecated use a if (model.type === "query") type narrowing check instead */
export const isQuery = (model: VariableModel): model is QueryVariableModel => {
  return model.type === 'query';
};

/** @deprecated use a if (model.type === "adhoc") type narrowing check instead */
export const isAdHoc = (model: VariableModel): model is AdHocVariableModel => {
  return model.type === 'adhoc';
};

/** @deprecated use a if (model.type === "constant") type narrowing check instead */
export const isConstant = (model: VariableModel): model is ConstantVariableModel => {
  return model.type === 'constant';
};

export const isMulti = (model: VariableModel): model is VariableWithMultiSupport => {
  return 'multi' in model;
};

export const hasOptions = (model: VariableModel): model is VariableWithOptions => {
  return 'options' in model;
};

export const hasCurrent = (model: VariableModel): model is VariableWithOptions => {
  return 'current' in model;
};

export function isLegacyAdHocDataSource(datasource: null | DataSourceRef | string): datasource is string {
  if (datasource === null) {
    return false;
  }

  return typeof datasource === 'string';
}

interface DataSourceWithLegacyVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
> extends DataSourceApi<TQuery, TOptions> {
  metricFindQuery(query: string, options?: LegacyMetricFindQueryOptions): Promise<MetricFindValue[]>;
  variables: undefined;
}

interface DataSourceWithStandardVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
> extends DataSourceApi<TQuery, TOptions> {
  variables: {
    getType(): VariableSupportType;
    toDataQuery(query: StandardVariableQuery): TQuery;
    query(request: DataQueryRequest<TQuery>): Observable<DataQueryResponse>;
  };
}

interface DataSourceWithCustomVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
> extends DataSourceApi<TQuery, TOptions> {
  variables: {
    getType(): VariableSupportType;
    editor: VariableQueryEditorType;
    query(request: DataQueryRequest<TQuery>): Observable<DataQueryResponse>;
  };
}

interface DataSourceWithDatasourceVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
> extends DataSourceApi<TQuery, TOptions> {
  variables: {
    getType(): VariableSupportType;
  };
}

/*
 * The following guard function are both TypeScript type guards.
 * They also make the basis for the logic used by variableQueryRunner and determining which QueryEditor to use
 * */
export const hasLegacyVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
>(
  datasource: DataSourceApi<TQuery, TOptions>
): datasource is DataSourceWithLegacyVariableSupport<TQuery, TOptions> => {
  return Boolean(datasource.metricFindQuery) && !Boolean(datasource.variables);
};

export const hasStandardVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
>(
  datasource: DataSourceApi<TQuery, TOptions>
): datasource is DataSourceWithStandardVariableSupport<TQuery, TOptions> => {
  if (!datasource.variables) {
    return false;
  }

  if (datasource.variables.getType() !== VariableSupportType.Standard) {
    return false;
  }

  const variableSupport = datasource.variables;
  return 'toDataQuery' in variableSupport && Boolean(variableSupport.toDataQuery);
};

export const hasCustomVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
>(
  datasource: DataSourceApi<TQuery, TOptions>
): datasource is DataSourceWithCustomVariableSupport<TQuery, TOptions> => {
  if (!datasource.variables) {
    return false;
  }

  if (datasource.variables.getType() !== VariableSupportType.Custom) {
    return false;
  }

  const variableSupport = datasource.variables;
  return (
    'query' in variableSupport &&
    'editor' in variableSupport &&
    Boolean(variableSupport.query) &&
    Boolean(variableSupport.editor)
  );
};

export const hasDatasourceVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
>(
  datasource: DataSourceApi<TQuery, TOptions>
): datasource is DataSourceWithDatasourceVariableSupport<TQuery, TOptions> => {
  if (!datasource.variables) {
    return false;
  }

  return datasource.variables.getType() === VariableSupportType.Datasource;
};

export function isLegacyQueryEditor<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
>(
  component: VariableQueryEditorType,
  datasource: DataSourceApi<TQuery, TOptions>
): component is ComponentType<VariableQueryEditorProps> {
  if (!component) {
    return false;
  }

  return component.displayName === LEGACY_VARIABLE_QUERY_EDITOR_NAME || hasLegacyVariableSupport(datasource);
}

export function isQueryEditor<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
>(
  component: VariableQueryEditorType,
  datasource: DataSourceApi<TQuery, TOptions>
): component is VariableQueryEditorType {
  if (!component) {
    return false;
  }

  return (
    component.displayName !== LEGACY_VARIABLE_QUERY_EDITOR_NAME &&
    (hasDatasourceVariableSupport(datasource) ||
      hasStandardVariableSupport(datasource) ||
      hasCustomVariableSupport(datasource))
  );
}
