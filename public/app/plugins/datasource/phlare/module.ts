import { DataSourcePlugin } from '@grafana/data';

import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor/QueryEditor';
import { FireDataSource } from './datasource';
import { Query, FireDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<FireDataSource, Query, FireDataSourceOptions>(FireDataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
