import { DataSourcePlugin } from '@grafana/ui';
import { ElasticDatasource } from './datasource';
import { ElasticQueryCtrl } from './query_ctrl';
// import { ElasticConfigCtrl } from './config_ctrl';
import ElasticsearchQueryField from './components/ElasticsearchQueryField';
import { ConfigEditor } from './components/ConfigEditor';

class ElasticAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(ElasticDatasource)
  .setQueryCtrl(ElasticQueryCtrl)
  // .setConfigCtrl(ElasticConfigCtrl)
  .setConfigEditor(ConfigEditor)
  .setExploreLogsQueryField(ElasticsearchQueryField)
  .setAnnotationQueryCtrl(ElasticAnnotationsQueryCtrl);
