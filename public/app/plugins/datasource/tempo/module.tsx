import { lazy, Suspense } from 'react';

import { DataSourcePlugin, DashboardLoadedEvent, type QueryEditorProps } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { LoadingPlaceholder } from '@grafana/ui';

import type { ConfigEditorProps } from './configuration/ConfigEditor';
import { TempoDatasource } from './datasource';
import { onDashboardLoadedHandler } from './tracking';
import type { TempoQuery } from './types';

// Lazy load the QueryField and ConfigEditor components to reduce the size of the initial bundle
const TempoQueryFieldLazy = lazy(() => import('./QueryField'));
const ConfigEditorLazy = lazy(() => import('./configuration/ConfigEditor'));
const CheatSheetLazy = lazy(() => import('./CheatSheet'));

function TempoQueryField(props: QueryEditorProps<TempoDatasource, TempoQuery>) {
  return (
    <Suspense fallback={<LoadingPlaceholder text={'Loading editor'} />}>
      <TempoQueryFieldLazy {...props} />
    </Suspense>
  );
}

function ConfigEditor(props: ConfigEditorProps) {
  return (
    <Suspense fallback={<LoadingPlaceholder text={'Loading editor'} />}>
      <ConfigEditorLazy {...props} />
    </Suspense>
  );
}

function CheatSheet() {
  return (
    <Suspense fallback={null}>
      <CheatSheetLazy />
    </Suspense>
  );
}

export const plugin = new DataSourcePlugin(TempoDatasource)
  .setQueryEditor(TempoQueryField)
  .setConfigEditor(ConfigEditor)
  .setQueryEditorHelp(CheatSheet);

// Subscribe to on dashboard loaded event so that we can track plugin adoption
getAppEvents().subscribe<DashboardLoadedEvent<TempoQuery>>(DashboardLoadedEvent, onDashboardLoadedHandler);
