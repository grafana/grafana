import { DataSourcePlugin } from '@grafana/data';
import { SQLQuery, SqlQueryEditorLazy } from '@grafana/sql';

import { CheatSheet } from './CheatSheet';
import { ConfigurationEditor } from './configuration/ConfigurationEditor';
import { MssqlDatasource } from './datasource';
import { MssqlOptions } from './types';

export const plugin = new DataSourcePlugin<MssqlDatasource, SQLQuery, MssqlOptions>(MssqlDatasource)
  .setQueryEditor(SqlQueryEditorLazy)
  .setQueryEditorHelp(CheatSheet)
  .setConfigEditor(ConfigurationEditor);
