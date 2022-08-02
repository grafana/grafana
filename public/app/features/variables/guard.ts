import { ComponentType } from 'react';
import { Observable } from 'rxjs';

import {
  CustomVariableSupport,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceJsonData,
  DataSourceRef,
  MetricFindValue,
  StandardVariableQuery,
  StandardVariableSupport,
  VariableModel,
  VariableSupportType,
} from '@grafana/data';

import { LEGACY_VARIABLE_QUERY_EDITOR_NAME } from './editor/LegacyVariableQueryEditor';
import {
  AdHocVariableModel,
  ConstantVariableModel,
  QueryVariableModel,
  VariableQueryEditorType,
  VariableQueryEditorProps,
  VariableWithMultiSupport,
  VariableWithOptions,
  DataSourceVariableModel,
} from './types';

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

export const isDataSource = (model: VariableModel): model is DataSourceVariableModel => {
  return model.type === 'datasource';
};

export const isMulti = (model: VariableModel): model is VariableWithMultiSupport => {
  const withMulti = model as VariableWithMultiSupport;
  return withMulti.hasOwnProperty('multi') && typeof withMulti.multi === 'boolean';
};

export const hasOptions = (model: VariableModel): model is VariableWithOptions => {
  return hasObjectProperty(model, 'options');
};

export const hasCurrent = (model: VariableModel): model is VariableWithOptions => {
  return hasObjectProperty(model, 'current');
};

function hasObjectProperty(model: VariableModel, property: string): model is VariableWithOptions {
  if (!model) {
    return false;
  }

  const withProperty = model as Record<string, any>;
  return withProperty.hasOwnProperty(property) && typeof withProperty[property] === 'object';
}

export function isLegacyAdHocDataSource(datasource: null | DataSourceRef | string): datasource is string {
  if (datasource === null) {
    return false;
  }

  return typeof datasource === 'string';
}

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
    getType(): VariableSupportType;
    toDataQuery(query: StandardVariableQuery): TQuery;
    query(request: DataQueryRequest<TQuery>): Observable<DataQueryResponse>;
  };
}

interface DataSourceWithCustomVariableSupport<
  VariableQuery extends DataQuery = any,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends DataSourceApi<TQuery, TOptions> {
  variables: {
    getType(): VariableSupportType;
    editor: VariableQueryEditorType;
    query(request: DataQueryRequest<TQuery>): Observable<DataQueryResponse>;
  };
}

interface DataSourceWithDatasourceVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
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
  TOptions extends DataSourceJsonData = DataSourceJsonData
>(
  datasource: DataSourceApi<TQuery, TOptions>
): datasource is DataSourceWithLegacyVariableSupport<TQuery, TOptions> => {
  return Boolean(datasource.metricFindQuery) && !Boolean(datasource.variables);
};

export const hasStandardVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
>(
  datasource: DataSourceApi<TQuery, TOptions>
): datasource is DataSourceWithStandardVariableSupport<TQuery, TOptions> => {
  if (!datasource.variables) {
    return false;
  }

  if (datasource.variables.getType() !== VariableSupportType.Standard) {
    return false;
  }

  const variableSupport = datasource.variables as StandardVariableSupport<DataSourceApi<TQuery, TOptions>>;

  return Boolean(variableSupport.toDataQuery);
};

export const hasCustomVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
>(
  datasource: DataSourceApi<TQuery, TOptions>
): datasource is DataSourceWithCustomVariableSupport<any, TQuery, TOptions> => {
  if (!datasource.variables) {
    return false;
  }

  if (datasource.variables.getType() !== VariableSupportType.Custom) {
    return false;
  }

  const variableSupport = datasource.variables as CustomVariableSupport<DataSourceApi<TQuery, TOptions>>;

  return Boolean(variableSupport.query) && Boolean(variableSupport.editor);
};

export const hasDatasourceVariableSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
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
  TOptions extends DataSourceJsonData = DataSourceJsonData
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
  TOptions extends DataSourceJsonData = DataSourceJsonData
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
