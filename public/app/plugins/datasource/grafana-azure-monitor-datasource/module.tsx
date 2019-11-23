import { DataSourcePlugin } from '@grafana/data';
import { AzureMonitorQueryCtrl } from './query_ctrl';
import Datasource from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import { AzureMonitorAnnotationsQueryCtrl } from './annotations_query_ctrl';
import { AzureMonitorQuery, AzureDataSourceJsonData } from './types';

export const plugin = new DataSourcePlugin<Datasource, AzureMonitorQuery, AzureDataSourceJsonData>(Datasource)
  .setConfigEditor(ConfigEditor)
  .setQueryCtrl(AzureMonitorQueryCtrl)
  .setAnnotationQueryCtrl(AzureMonitorAnnotationsQueryCtrl);
