// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/module.ts
// DONT NEED THIS BUT MAYBE EXPORT THIS TO CORE PROM

import { DataSourcePlugin } from '@grafana/data';

import { PromCheatSheet } from './components/PromCheatSheet';
import { PromQueryEditorByApp } from './components/PromQueryEditorByApp';
import { ConfigEditor } from './configuration/ConfigEditor';
import { PrometheusDatasource } from './datasource';

export const plugin = new DataSourcePlugin(PrometheusDatasource)
  .setQueryEditor(PromQueryEditorByApp)
  .setConfigEditor(ConfigEditor)
  .setQueryEditorHelp(PromCheatSheet);
