import { DataSourcePlugin } from '@grafana/data';
import { PromCheatSheet, PrometheusDatasource, PromQueryEditorByApp } from '@grafana/prometheus';

import { ErrorsAndNoticesInspector } from './ErrorsAndNoticesInspector';
import { ConfigEditor } from './configuration/ConfigEditor';

export const plugin = new DataSourcePlugin(PrometheusDatasource)
  .setQueryEditor(PromQueryEditorByApp)
  .setConfigEditor(ConfigEditor)
  .setErrorsAndNoticesInspector(ErrorsAndNoticesInspector)
  .setQueryEditorHelp(PromCheatSheet);
