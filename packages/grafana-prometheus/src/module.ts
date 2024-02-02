import { DataSourcePlugin } from '@grafana/data';

import { PromCheatSheet } from './components/PromCheatSheet';
import { MemoPromQueryEditorByApp as PromQueryEditorByApp } from './components/PromQueryEditorByApp';
import { ConfigEditor } from './configuration/ConfigEditor';
import { PrometheusDatasource } from './datasource';

export const plugin = new DataSourcePlugin(PrometheusDatasource)
  .setQueryEditor(PromQueryEditorByApp)
  .setConfigEditor(ConfigEditor)
  .setQueryEditorHelp(PromCheatSheet);
