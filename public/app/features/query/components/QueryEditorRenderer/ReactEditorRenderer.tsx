import React from 'react';
import { DataSourceApi } from '@grafana/data';
import { EditorRendererProps } from './types';

export function ReactEditorRenderer(props: EditorRendererProps): JSX.Element | null {
  const { app, dataSource, data, query, timeRange, onRunQuery, onChange } = props;
  const QueryEditor = dataSource.components?.QueryEditor;

  if (!QueryEditor) {
    return null;
  }

  return (
    <QueryEditor
      data={data}
      range={timeRange}
      onRunQuery={onRunQuery}
      query={query}
      datasource={dataSource}
      onChange={onChange}
      app={app}
    />
  );
}

export function hasReactQueryEditor(dataSource: DataSourceApi): boolean {
  return !!dataSource.components?.QueryEditor;
}
