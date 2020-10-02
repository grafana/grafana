import { DataSourcePlugin } from '@grafana/data';
import { ElasticDatasource } from './datasource';
import { ElasticQueryCtrl } from './query_ctrl';
import { ConfigEditor } from './configuration/ConfigEditor';

class ElasticAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(ElasticDatasource)
  .setQueryCtrl(ElasticQueryCtrl)
  .setConfigEditor(ConfigEditor)
  .setAnnotationQueryCtrl(ElasticAnnotationsQueryCtrl);
