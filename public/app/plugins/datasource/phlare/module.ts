import { DataSourcePlugin } from '@grafana/data';

import { ConfigEditor } from '../grafana-pyroscope/ConfigEditor';
import { QueryEditor } from '../grafana-pyroscope/QueryEditor/QueryEditor';
import { PhlareDataSource } from '../grafana-pyroscope/datasource';
import { Query, PhlareDataSourceOptions } from '../grafana-pyroscope/types';

export const plugin = new DataSourcePlugin<PhlareDataSource, Query, PhlareDataSourceOptions>(PhlareDataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
