import { ElasticDatasource } from './datasource';
import { ElasticQueryCtrl } from './query_ctrl';
import { ElasticConfigCtrl } from './config_ctrl';
import { ElasticVariableQueryEditor } from './components/VariableQueryEditor';

class ElasticAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  ElasticDatasource as Datasource,
  ElasticQueryCtrl as QueryCtrl,
  ElasticConfigCtrl as ConfigCtrl,
  ElasticAnnotationsQueryCtrl as AnnotationsQueryCtrl,
  ElasticVariableQueryEditor as VariableQueryEditor,
};
