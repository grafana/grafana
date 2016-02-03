import {OpenTsDatasource} from './datasource';
import {OpenTsQueryCtrl} from './query_ctrl';

class OpenTsConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/opentsdb/partials/config.html';
}

export {
  OpenTsDatasource as Datasource,
  OpenTsQueryCtrl as QueryCtrl,
  OpenTsConfigCtrl as ConfigCtrl,
};

