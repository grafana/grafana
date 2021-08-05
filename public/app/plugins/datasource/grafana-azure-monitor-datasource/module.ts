import { DataSourcePlugin } from '@grafana/data';
import Datasource from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import AzureMonitorQueryEditor from './components/QueryEditor';
import { AzureMonitorAnnotationsQueryCtrl } from './annotations_query_ctrl';
import { AzureMonitorQuery, AzureDataSourceJsonData } from './types';

export const plugin = new DataSourcePlugin<Datasource, AzureMonitorQuery, AzureDataSourceJsonData>(Datasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(AzureMonitorQueryEditor)
  .setAnnotationQueryCtrl(AzureMonitorAnnotationsQueryCtrl);
