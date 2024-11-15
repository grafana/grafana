import { DataSourcePlugin } from '@grafana/data';
import { SQLQuery, SqlQueryEditorLazy } from '@grafana/sql';

import { CheatSheet } from './CheatSheet';
import { MySqlDatasource } from './MySqlDatasource';
import { ConfigurationEditor } from './configuration/ConfigurationEditor';
import { MySQLOptions } from './types';

export const plugin = new DataSourcePlugin<MySqlDatasource, SQLQuery, MySQLOptions>(MySqlDatasource)
  .setQueryEditor(SqlQueryEditorLazy)
  .setQueryEditorHelp(CheatSheet)
  .setConfigEditor(ConfigurationEditor);
