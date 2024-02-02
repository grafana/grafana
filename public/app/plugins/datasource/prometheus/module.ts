import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor, PromCheatSheet, MemoPromQueryEditorByApp as PromQueryEditorByApp } from '@grafana/prometheus';

import { PrometheusDatasource } from './datasource';

export const plugin = new DataSourcePlugin(PrometheusDatasource)
  // @ts-ignore
  .setQueryEditor(PromQueryEditorByApp)
  .setConfigEditor(ConfigEditor)
  .setQueryEditorHelp(PromCheatSheet);
