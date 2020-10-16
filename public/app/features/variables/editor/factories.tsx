import React, { ComponentType, useCallback } from 'react';
import { DataQuery, DataSourceApi, DataSourceJsonData, DefaultVariableQuery, QueryEditorProps } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { LEGACY_VARIABLE_QUERY_EDITOR_NAME, LegacyVariableQueryEditor } from './LegacyVariableQueryEditor';
import {
  hasCustomVariableSupport,
  hasDatasourceVariableSupport,
  hasDefaultVariableSupport,
  hasLegacyVariableSupport,
} from '../guard';
import { VariableQueryProps } from '../../../types';

export type VariableQueryEditorType<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> = ComponentType<VariableQueryProps> | ComponentType<QueryEditorProps<any, TQuery, TOptions, any>> | null;

export function isLegacyQueryEditor<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
>(
  component: VariableQueryEditorType,
  datasource: DataSourceApi<TQuery, TOptions>
): component is ComponentType<VariableQueryProps> {
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
): component is ComponentType<QueryEditorProps<any>> {
  if (!component) {
    return false;
  }

  return (
    component.displayName !== LEGACY_VARIABLE_QUERY_EDITOR_NAME &&
    (hasDatasourceVariableSupport(datasource) ||
      hasDefaultVariableSupport(datasource) ||
      hasCustomVariableSupport(datasource))
  );
}

export function variableQueryEditorFactory<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
  VariableQuery extends DataQuery = TQuery
>(datasource: DataSourceApi<TQuery, TOptions>): VariableQueryEditorType {
  if (hasCustomVariableSupport(datasource)) {
    return datasource.variables.custom.editor;
  }

  if (hasDatasourceVariableSupport(datasource)) {
    return datasource.variables.datasource.editor;
  }

  if (hasDefaultVariableSupport(datasource)) {
    return DefaultVariableQueryEditor;
  }

  return null;
}

function DefaultVariableQueryEditor<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
>({
  datasource: propsDatasource,
  query: propsQuery,
  onChange: propsOnChange,
}: QueryEditorProps<any, TQuery, TOptions, DefaultVariableQuery>) {
  const onChange = useCallback(
    (query: any) => {
      propsOnChange({ refId: 'DefaultVariableQueryEditor', query });
    },
    [propsOnChange]
  );

  return (
    <LegacyVariableQueryEditor
      query={propsQuery.query}
      onChange={onChange}
      datasource={propsDatasource}
      templateSrv={getTemplateSrv()}
    />
  );
}
