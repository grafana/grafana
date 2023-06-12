import { DataSourcePlugin, DashboardLoadedEvent } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

import CheatSheet from './CheatSheet';
import { TempoQueryField } from './QueryEditor/QueryField';
import { ConfigEditor } from './configuration/ConfigEditor';
import { TempoDatasource } from './datasource';
import { onDashboardLoadedHandler } from './tracking';
import { TempoQuery } from './types';

export const plugin = new DataSourcePlugin(TempoDatasource)
  .setQueryEditor(TempoQueryField)
  .setConfigEditor(ConfigEditor)
  .setQueryEditorHelp(CheatSheet);

// Subscribe to on dashboard loaded event so that we can track plugin adoption
getAppEvents().subscribe<DashboardLoadedEvent<TempoQuery>>(DashboardLoadedEvent, onDashboardLoadedHandler);
