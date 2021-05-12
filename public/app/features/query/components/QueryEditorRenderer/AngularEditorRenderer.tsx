import React, { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import { DataSourceApi, EventBusSrv } from '@grafana/data';
import { AngularComponent, getAngularLoader } from '@grafana/runtime';
import { AngularQueryComponentScope } from '../QueryEditorRow';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { EditorRendererProps } from './types';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

export function AngularEditorRenderer(props: EditorRendererProps): JSX.Element | null {
  const elementRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<AngularComponent>();
  const scopeRef = useComponentScope(props);
  const dataSourceIdentifier = useDataSourceIdentifier(props);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.destroy();
      editorRef.current = undefined;
    }

    const loader = getAngularLoader();
    const template = '<plugin-component type="query-ctrl" />';
    const ctrl = scopeRef.current;
    const editor = loader.load(elementRef, { ctrl }, template);

    editorRef.current = editor;

    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [dataSourceIdentifier, scopeRef]);

  return <div ref={elementRef} />;
}

export function hasAngularQueryEditor(dataSource: DataSourceApi): boolean {
  return !!dataSource.components?.QueryCtrl;
}

function useComponentScope(props: EditorRendererProps): MutableRefObject<AngularQueryComponentScope | undefined> {
  const { query, queries, dataSource, timeRange, onChange, onRunQuery, app } = props;
  const scopeRef = useRef<AngularQueryComponentScope>();

  scopeRef.current = useMemo(() => {
    const panel = new PanelModel({ targets: queries });
    const dashboard = {} as DashboardModel;

    return {
      datasource: dataSource,
      target: query,
      panel: panel,
      dashboard: dashboard,
      refresh: () => {
        onChange(query);
        onRunQuery();
      },
      render: () => () => console.log('legacy render function called, it does nothing'),
      events: new EventBusSrv(),
      range: timeRange || getTimeSrv().timeRange(),
      app: app,
    };
  }, [app, queries, dataSource, timeRange, query, onChange, onRunQuery]);

  return scopeRef;
}

function useDataSourceIdentifier(props: EditorRendererProps): string {
  const { query, dataSource } = props;
  return query.datasource || dataSource.name;
}
