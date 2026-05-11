import { DataSourcePlugin } from '@grafana/data';
import { type SQLQuery } from '@grafana/sql';

import { CheatSheet } from './CheatSheet';
import { PostgresQueryEditor } from './PostgresQueryEditor';
import { PostgresConfigEditor } from './configuration/ConfigurationEditor';
import { PostgresDatasource } from './datasource';
import { type PostgresOptions, type SecureJsonData } from './types';

export const plugin = new DataSourcePlugin<PostgresDatasource, SQLQuery, PostgresOptions, SecureJsonData>(
  PostgresDatasource
)
  .setQueryEditor(PostgresQueryEditor)
  .setQueryEditorHelp(CheatSheet)
  .setConfigEditor(PostgresConfigEditor);
