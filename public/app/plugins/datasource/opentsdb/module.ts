import OpenTsDatasource from './datasource';
import { OpenTsQueryCtrl } from './query_ctrl';
import { OpenTsConfigCtrl } from './config_ctrl';

class AnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  OpenTsDatasource as Datasource,
  OpenTsQueryCtrl as QueryCtrl,
  OpenTsConfigCtrl as ConfigCtrl,
  AnnotationsQueryCtrl,
};
