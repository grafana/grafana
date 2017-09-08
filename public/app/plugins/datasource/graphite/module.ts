import {GraphiteDatasource} from './datasource';
import {GraphiteQueryCtrl} from './query_ctrl';
import {GraphiteConfigCtrl} from './config_ctrl';

class AnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  GraphiteDatasource as Datasource,
  GraphiteQueryCtrl as QueryCtrl,
  GraphiteConfigCtrl as ConfigCtrl,
  AnnotationsQueryCtrl as AnnotationsQueryCtrl,
};

