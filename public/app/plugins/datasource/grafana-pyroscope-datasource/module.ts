import { DataSourcePlugin } from '@grafana/data';

import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor/QueryEditor';
import { PhlareDataSource } from './datasource';
import { Query, PhlareDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<PhlareDataSource, Query, PhlareDataSourceOptions>(PhlareDataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
