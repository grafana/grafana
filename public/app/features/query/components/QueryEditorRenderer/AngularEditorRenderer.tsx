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

  useEffect(() => {
    const loader = getAngularLoader();
    const template = '<plugin-component type="query-ctrl" />';
    const ctrl = scopeRef.current;
    const editor = loader.load(elementRef.current, { ctrl }, template);

    editorRef.current = editor;

    return () => {
      if (editor) {
        console.log('destroying');
        editor.destroy();
      }
    };
  }, [scopeRef]);

  return <div ref={elementRef} />;
}

export function hasAngularQueryEditor(dataSource: DataSourceApi): boolean {
  return !!dataSource.components?.QueryCtrl;
}

function useComponentScope(props: EditorRendererProps): MutableRefObject<AngularQueryComponentScope | undefined> {
  const { query, queries, dataSource, timeRange, onChange, onRunQuery } = props;
  const scopeRef = useRef<AngularQueryComponentScope>();

  scopeRef.current = useMemo(() => {
    const scope = getOrCreateScope(scopeRef);

    scope.panel = new PanelModel({ targets: queries });
    scope.datasource = dataSource;
    scope.target = query;
    scope.refresh = () => {
      onChange(query);
      onRunQuery();
    };
    scope.range = timeRange || getTimeSrv().timeRange();

    return scope;
  }, [queries, dataSource, timeRange, query, onChange, onRunQuery]);

  return scopeRef;
}

function getOrCreateScope(
  scopeRef: MutableRefObject<AngularQueryComponentScope | undefined>
): AngularQueryComponentScope {
  if (scopeRef.current) {
    return scopeRef.current;
  }

  return ({
    dashboard: {} as DashboardModel,
    render: () => () => console.log('legacy render function called, it does nothing'),
    events: new EventBusSrv(),
  } as unknown) as AngularQueryComponentScope;
}
