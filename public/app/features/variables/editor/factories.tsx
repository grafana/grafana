import React, { ComponentType, FC, useCallback } from 'react';
import {
  DataQuery,
  DataSourceApi,
  DataSourceJsonData,
  DefaultVariableQuery,
  VariableQueryEditorProps,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { LEGACY_VARIABLE_QUERY_EDITOR_NAME, LegacyVariableQueryEditor } from './LegacyVariableQueryEditor';
import {
  hasCustomVariableSupport,
  hasDatasourceVariableSupport,
  hasDefaultVariableSupport,
  hasLegacyVariableSupport,
} from '../guard';
import { VariableQueryProps } from '../../../types';

export type VariableQueryEditorType =
  | ComponentType<VariableQueryProps>
  | ComponentType<VariableQueryEditorProps<any>>
  | null;

export const isLegacyQueryEditor = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
>(
  component: VariableQueryEditorType,
  datasource: DataSourceApi<TQuery, TOptions>
): component is ComponentType<VariableQueryProps> => {
  if (!component) {
    return false;
  }

  return component.displayName === LEGACY_VARIABLE_QUERY_EDITOR_NAME || hasLegacyVariableSupport(datasource);
};

export const isQueryEditor = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
>(
  component: VariableQueryEditorType,
  datasource: DataSourceApi<TQuery, TOptions>
): component is ComponentType<VariableQueryEditorProps<any>> => {
  if (!component) {
    return false;
  }

  return (
    component.displayName !== LEGACY_VARIABLE_QUERY_EDITOR_NAME &&
    (hasDatasourceVariableSupport(datasource) ||
      hasDefaultVariableSupport(datasource) ||
      hasCustomVariableSupport(datasource))
  );
};

export const variableQueryEditorFactory = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  VariableQuery extends DataQuery = DataQuery
>(
  datasource: DataSourceApi<TQuery, TOptions>
): FC<VariableQueryEditorProps<any, TQuery, TOptions, any>> => {
  if (hasCustomVariableSupport(datasource)) {
    return customVariableQueryEditorFactory<TQuery, TOptions, VariableQuery>();
  }

  if (hasDatasourceVariableSupport(datasource)) {
    return datasourceVariableQueryEditorFactory<TQuery, TOptions>();
  }

  return defaultVariableQueryEditorFactory<TQuery, TOptions>();
};

const defaultVariableQueryEditorFactory = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
>(): FC<VariableQueryEditorProps<any, TQuery, TOptions, DefaultVariableQuery>> => ({
  datasource: propsDatasource,
  query: propsQuery,
  onChange: propsOnChange,
}) => {
  const onChange = useCallback(
    (query: any) => {
      propsOnChange({ refId: 'DefaultVariableQueryEditor', query });
    },
    [propsOnChange]
  );

  if (!hasDefaultVariableSupport(propsDatasource)) {
    return null;
  }

  return (
    <LegacyVariableQueryEditor
      query={propsQuery.query}
      onChange={onChange}
      datasource={propsDatasource}
      templateSrv={getTemplateSrv()}
    />
  );
};

const customVariableQueryEditorFactory = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  VariableQuery extends DataQuery = any
>(): FC<VariableQueryEditorProps<any, TQuery, TOptions, VariableQuery>> => ({
  datasource: propsDatasource,
  query: propsQuery,
  onChange: propsOnChange,
}) => {
  if (!hasCustomVariableSupport(propsDatasource)) {
    return null;
  }

  const VariableQueryEditor = propsDatasource.variables.custom.editor;

  return <VariableQueryEditor datasource={propsDatasource} query={propsQuery} onChange={propsOnChange} />;
};

const datasourceVariableQueryEditorFactory = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
>(): FC<VariableQueryEditorProps<any, TQuery, TOptions, TQuery>> => ({
  datasource: propsDatasource,
  query: propsQuery,
  onChange: propsOnChange,
}) => {
  if (!hasDatasourceVariableSupport(propsDatasource)) {
    return null;
  }

  const VariableQueryEditor = propsDatasource.variables.datasource.editor;

  return <VariableQueryEditor datasource={propsDatasource} query={propsQuery} onChange={propsOnChange} />;
};
