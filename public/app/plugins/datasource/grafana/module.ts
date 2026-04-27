import { DataSourcePlugin } from '@grafana/data/types';

import { QueryEditor } from './components/QueryEditor';
import { GrafanaDatasource } from './datasource';
import { type GrafanaQuery } from './types';

export const plugin = new DataSourcePlugin<GrafanaDatasource, GrafanaQuery>(GrafanaDatasource).setQueryEditor(
  QueryEditor
);
