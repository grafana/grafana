import { DataSourcePlugin } from '@grafana/data';

import { QueryEditor } from './components/QueryEditor';
import { GrafanaDatasource } from './datasource';
import { GrafanaQuery } from './types';

export const plugin = new DataSourcePlugin<GrafanaDatasource, GrafanaQuery>(GrafanaDatasource).setQueryEditor(
  QueryEditor
);
