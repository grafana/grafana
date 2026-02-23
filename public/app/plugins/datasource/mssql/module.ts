import { DataSourcePlugin } from '@grafana/data';
import { initPluginTranslations } from '@grafana/i18n';
import { SQLQuery, SqlQueryEditorLazy, loadResources as loadSQLResources } from '@grafana/sql';

import { CheatSheet } from './CheatSheet';
import { ConfigurationEditor } from './configuration/ConfigurationEditor';
import { MssqlDatasource } from './datasource';
import pluginJson from './plugin.json';
import { MssqlOptions } from './types';

// don't load plugin translations in test environments
// we don't use them anyway, and top-level await won't work currently in jest
if (process.env.NODE_ENV !== 'test') {
  await initPluginTranslations(pluginJson.id, [loadSQLResources]);
}

export const plugin = new DataSourcePlugin<MssqlDatasource, SQLQuery, MssqlOptions>(MssqlDatasource)
  .setQueryEditor(SqlQueryEditorLazy)
  .setQueryEditorHelp(CheatSheet)
  .setConfigEditor(ConfigurationEditor);
