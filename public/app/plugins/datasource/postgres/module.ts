import { DataSourcePlugin } from '@grafana/data';
import { SQLQuery } from 'app/features/plugins/sql/types';

import { CheatSheet } from './CheatSheet';
import { QueryEditor } from './QueryEditor';
import { PostgresConfigEditor } from './configuration/ConfigurationEditor';
import { PostgresDatasource } from './datasource';
import { PostgresOptions, SecureJsonData } from './types';

export const plugin = new DataSourcePlugin<PostgresDatasource, SQLQuery, PostgresOptions, SecureJsonData>(
  PostgresDatasource
)
  .setQueryEditor(QueryEditor)
  .setQueryEditorHelp(CheatSheet)
  .setConfigEditor(PostgresConfigEditor);
