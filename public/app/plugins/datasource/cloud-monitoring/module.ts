import { DataSourcePlugin } from '@grafana/data';
import CloudMonitoringDatasource from './datasource';
import { QueryEditor } from './components/QueryEditor';
import { ConfigEditor } from './components/ConfigEditor/ConfigEditor';

import { CloudMonitoringAnnotationsQueryCtrl } from './annotations_query_ctrl';
import { CloudMonitoringVariableQueryEditor } from './components/VariableQueryEditor';
import { CloudMonitoringQuery } from './types';

export const plugin = new DataSourcePlugin<CloudMonitoringDatasource, CloudMonitoringQuery>(CloudMonitoringDatasource)
  .setQueryEditor(QueryEditor)
  .setConfigEditor(ConfigEditor)
  .setAnnotationQueryCtrl(CloudMonitoringAnnotationsQueryCtrl)
  .setVariableQueryEditor(CloudMonitoringVariableQueryEditor);
