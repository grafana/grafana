import { DataSourcePlugin } from '@grafana/data';

import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor/QueryEditor';
import { ParcaDataSource } from './datasource';
import { type Query, type ParcaDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<ParcaDataSource, Query, ParcaDataSourceOptions>(ParcaDataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
