import React, { FC, useCallback } from 'react';
import {
  CustomVariableQueryEditorProps,
  DataQuery,
  DataSourceApi,
  DataSourceJsonData,
  DefaultVariableQueryEditorProps,
  VariableQueryEditorProps,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import LegacyVariableQueryEditor from './LegacyVariableQueryEditor';
import { hasCustomVariableSupport, hasDatasourceVariableSupport, hasDefaultVariableSupport } from '../guard';

export const variableQueryEditorFactory = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  VariableQuery extends DataQuery = DataQuery
>(
  datasource: DataSourceApi<TQuery, TOptions>
): FC<VariableQueryEditorProps<TQuery, TOptions, any>> => {
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
>(): FC<DefaultVariableQueryEditorProps<TQuery, TOptions>> => ({
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
      query={propsQuery}
      onChange={onChange}
      datasource={propsDatasource}
      templateSrv={getTemplateSrv()}
    />
  );
};

const customVariableQueryEditorFactory = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  VariableQuery extends DataQuery = DataQuery
>(): FC<CustomVariableQueryEditorProps<TQuery, TOptions, VariableQuery>> => ({
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
>(): FC<CustomVariableQueryEditorProps<TQuery, TOptions, TQuery>> => ({
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
