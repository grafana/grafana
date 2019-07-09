import { DataSourcePlugin } from '@grafana/ui';
import { AzureMonitorQueryCtrl } from './query_ctrl';
import Datasource from './datasource';
import { ConfigEditor } from './ConfigEditor';
import { AzureMonitorAnnotationsQueryCtrl } from './annotations_query_ctrl';

export const plugin = new DataSourcePlugin(Datasource)
  .setConfigEditor(ConfigEditor)
  .setQueryCtrl(AzureMonitorQueryCtrl)
  .setAnnotationQueryCtrl(AzureMonitorAnnotationsQueryCtrl);
