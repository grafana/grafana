import { DataSourcePlugin } from '@grafana/data';

import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor/QueryEditor';
import { PyroscopeDataSource } from './datasource';
import { Query, PyroscopeDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<PyroscopeDataSource, Query, PyroscopeDataSourceOptions>(PyroscopeDataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
