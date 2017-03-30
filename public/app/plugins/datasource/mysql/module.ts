///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import {MysqlDatasource} from './datasource';
import {QueryCtrl} from 'app/plugins/sdk';

class MysqlQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
}

class MysqlConfigCtrl {
  static templateUrl = 'partials/config.html';
}

export {
  MysqlDatasource,
  MysqlDatasource as Datasource,
  MysqlQueryCtrl as QueryCtrl,
  MysqlConfigCtrl as ConfigCtrl,
};

