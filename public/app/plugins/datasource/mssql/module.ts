import { DataSourcePlugin } from '@grafana/data';
import { SqlQueryEditor } from 'app/features/plugins/sql/components/QueryEditor';
import { SQLQuery } from 'app/features/plugins/sql/types';

import { ConfigurationEditor } from './configuration/ConfigurationEditor';
import { MssqlDatasource } from './datasource';
import { MssqlOptions } from './types';

export const plugin = new DataSourcePlugin<MssqlDatasource, SQLQuery, MssqlOptions>(MssqlDatasource)
  .setQueryEditor(SqlQueryEditor)
  .setConfigEditor(ConfigurationEditor);
