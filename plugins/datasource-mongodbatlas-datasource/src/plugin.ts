import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { QueryEditor } from './components/QueryEditor';
import { ConfigEditor } from './components/ConfigEditor';
import { MyQuery, MyDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<DataSource, MyQuery, MyDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
