import { DataSourcePlugin } from '@grafana/data';
import { SqlQueryEditor } from 'app/features/plugins/sql/components/QueryEditor';
import { SQLQuery } from 'app/features/plugins/sql/types';

import { MssqlConfigCtrl } from './config_ctrl';
import { MssqlDatasource } from './datasource';

export const plugin = new DataSourcePlugin<MssqlDatasource, SQLQuery>(MssqlDatasource)
  .setQueryEditor(SqlQueryEditor)
  .setConfigCtrl(MssqlConfigCtrl);
