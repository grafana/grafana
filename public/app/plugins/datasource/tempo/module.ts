import { DataSourcePlugin, DashboardLoadedEvent } from '@grafana/data';
import { config, getAppEvents, getDataSourceSrv, setDataSourceSrv } from '@grafana/runtime';

import CheatSheet from './CheatSheet';
import { TempoQueryField } from './QueryField';
import { ConfigEditor } from './configuration/ConfigEditor';
import { TempoDatasource } from './datasource';
import { onDashboardLoadedHandler } from './tracking';
import { TempoQuery } from './types';

import { DatasourceSrv } from '/Users/fabriziocasatigrafana/Documents/github_repos/grafana/public/app/features/plugins/datasource_srv';

const dataSourceSrv = new DatasourceSrv();
dataSourceSrv.init(config.datasources, config.defaultDatasource);
setDataSourceSrv(dataSourceSrv);
console.log('tempo/module', getDataSourceSrv());

export const plugin = new DataSourcePlugin(TempoDatasource)
  .setQueryEditor(TempoQueryField)
  .setConfigEditor(ConfigEditor)
  .setQueryEditorHelp(CheatSheet);

// Subscribe to on dashboard loaded event so that we can track plugin adoption
getAppEvents().subscribe<DashboardLoadedEvent<TempoQuery>>(DashboardLoadedEvent, onDashboardLoadedHandler);
