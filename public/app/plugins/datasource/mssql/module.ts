import { DataSourcePlugin } from '@grafana/data';
import { initPluginTranslations } from '@grafana/i18n';
import { SQLQuery, SqlQueryEditorLazy } from '@grafana/sql';

import { CheatSheet } from './CheatSheet';
import { ConfigurationEditor } from './configuration/ConfigurationEditor';
import { MssqlDatasource } from './datasource';
import pluginJson from './plugin.json';
import { MssqlOptions } from './types';

initPluginTranslations(pluginJson.id);

export const plugin = new DataSourcePlugin<MssqlDatasource, SQLQuery, MssqlOptions>(MssqlDatasource)
  .setQueryEditor(SqlQueryEditorLazy)
  .setQueryEditorHelp(CheatSheet)
  .setConfigEditor(ConfigurationEditor);
