import { DataSourcePlugin } from '@grafana/data';
import { SqlQueryEditor } from 'app/features/plugins/sql/components/QueryEditor';
import { SQLQuery } from 'app/features/plugins/sql/types';

import { CheatSheet } from './CheatSheet';
import { MySqlDatasource } from './MySqlDatasource';
import { ConfigurationEditor } from './configuration/ConfigurationEditor';
import { MySQLOptions } from './types';

export const plugin = new DataSourcePlugin<MySqlDatasource, SQLQuery, MySQLOptions>(MySqlDatasource)
  .setQueryEditor(SqlQueryEditor)
  .setQueryEditorHelp(CheatSheet)
  .setConfigEditor(ConfigurationEditor);
