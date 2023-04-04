import { DataSourcePlugin } from '@grafana/data';
// import { SqlQueryEditor } from 'app/features/plugins/sql/components/QueryEditor';
import { SQLQuery } from 'app/features/plugins/sql/types';

import { PostgresQueryEditor } from './PostgresQueryEditor';
import { PostgresConfigEditor } from './configuration/ConfigurationEditor';
import { PostgresDatasource } from './datasource';
import { PostgresOptions, SecureJsonData } from './types';

export const plugin = new DataSourcePlugin<PostgresDatasource, SQLQuery, PostgresOptions, SecureJsonData>(
  PostgresDatasource
)
  .setQueryEditor(PostgresQueryEditor)
  .setConfigEditor(PostgresConfigEditor);
