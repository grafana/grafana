import { DataSourcePlugin } from '@grafana/data';

import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor/QueryEditor';
import { ParcaDataSource } from './datasource';
import { Query, MyDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<ParcaDataSource, Query, MyDataSourceOptions>(ParcaDataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
