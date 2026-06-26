import { DataSourcePlugin } from '@grafana/data';
import { SQLQuery, SqlQueryEditor } from '@grafana/sql';

import { CheatSheet } from './CheatSheet';
import { MySqlDatasource } from './MySqlDatasource';
import { ConfigurationEditor } from './configuration/ConfigurationEditor';
import { MySQLOptions } from './types';

export const plugin = new DataSourcePlugin<MySqlDatasource, SQLQuery, MySQLOptions>(MySqlDatasource)
  .setQueryEditor(SqlQueryEditor)
  .setQueryEditorHelp(CheatSheet)
  .setConfigEditor(ConfigurationEditor);
