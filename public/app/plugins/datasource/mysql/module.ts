import { DataSourcePlugin } from '@grafana/data';
import { SQLQuery } from 'app/features/plugins/sql/types';

import { MySqlDatasource } from './MySqlDatasource';
import { QueryEditor } from './QueryEditor';
import { ConfigurationEditor } from './configuration/ConfigurationEditor';
import { MySQLOptions } from './types';

export const plugin = new DataSourcePlugin<MySqlDatasource, SQLQuery, MySQLOptions>(MySqlDatasource)
  .setQueryEditor(QueryEditor)
  .setConfigEditor(ConfigurationEditor);
