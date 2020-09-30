import { DataSourcePlugin } from '@grafana/data';
import { GrafanaDatasource } from './datasource';
import { QueryEditor } from './components/QueryEditor';
import { GrafanaQuery } from './types';
import { GrafanaAnnotationsQueryCtrl } from './annotation_ctrl';

export const plugin = new DataSourcePlugin<GrafanaDatasource, GrafanaQuery>(GrafanaDatasource)
  .setQueryEditor(QueryEditor)
  .setAnnotationQueryCtrl(GrafanaAnnotationsQueryCtrl);
