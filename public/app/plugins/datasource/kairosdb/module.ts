import {KairosDBDatasource} from './datasource';
import {KairosDBQueryCtrl} from './query_ctrl';

class KairosDBConfigCtrl {
  static templateUrl = "partials/config.html";
}

class KairosDBQueryOptionsCtrl {
  static templateUrl = "partials/query.options.html";
}

export {
    KairosDBDatasource as Datasource,
    KairosDBQueryCtrl as QueryCtrl,
    KairosDBConfigCtrl as ConfigCtrl,
    KairosDBQueryOptionsCtrl as QueryOptionsCtrl
};
