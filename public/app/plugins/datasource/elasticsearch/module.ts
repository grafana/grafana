import {ElasticDatasource} from './datasource';
import {ElasticQueryCtrl} from './query_ctrl';
import {ElasticConfigCtrl} from './config_ctrl';

class ElasticQueryOptionsCtrl {
  static templateUrl = 'public/app/plugins/datasource/elasticsearch/partials/query.options.html';
}

class ElasticAnnotationsQueryCtrl {
  static templateUrl = 'public/app/plugins/datasource/elasticsearch/partials/annotations.editor.html';
}

export {
  ElasticDatasource as Datasource,
  ElasticQueryCtrl as QueryCtrl,
  ElasticConfigCtrl as ConfigCtrl,
  ElasticQueryOptionsCtrl as QueryOptionsCtrl,
  ElasticAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};
