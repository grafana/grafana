import { ElasticDatasource } from './datasource';
import { ElasticQueryCtrl } from './query_ctrl';
import { ElasticConfigCtrl } from './config_ctrl';

class ElasticAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  ElasticDatasource as Datasource,
  ElasticQueryCtrl as QueryCtrl,
  ElasticConfigCtrl as ConfigCtrl,
  ElasticAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};
