import { DataSourcePlugin } from '@grafana/data';
import { DruidDataSource } from './DruidDataSource';
import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor';
import { VariableQueryEditor } from './VariableQueryEditor';
import { DruidQuery, DruidSettings } from './types';

export const plugin = new DataSourcePlugin<DruidDataSource, DruidQuery, DruidSettings>(DruidDataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setVariableQueryEditor(VariableQueryEditor);
