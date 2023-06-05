import { DataSourcePlugin } from '@grafana/data';

import { HealthCheckDetails } from './components/HealthCheckDetails';
import PromCheatSheet from './components/PromCheatSheet';
import PromQueryEditorByApp from './components/PromQueryEditorByApp';
import { ConfigEditor } from './configuration/ConfigEditor';
import { PrometheusDatasource } from './datasource';

export const plugin = new DataSourcePlugin(PrometheusDatasource)
  .setQueryEditor(PromQueryEditorByApp)
  .setConfigEditor(ConfigEditor)
  .setQueryEditorHelp(PromCheatSheet)
  .setHealthCheckDetails(HealthCheckDetails);
