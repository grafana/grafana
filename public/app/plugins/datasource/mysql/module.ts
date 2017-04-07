///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import {MysqlDatasource} from './datasource';
import {QueryCtrl} from 'app/plugins/sdk';

class MysqlQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  resultFormats: any;
  target: any;

  constructor($scope, $injector) {
    super($scope, $injector);

    this.target.resultFormat = 'time_series';
    this.target.alias = "{{table}}{{col_3}}";
    this.resultFormats = [
      {text: 'Time series', value: 'time_series'},
      {text: 'Table', value: 'table'},
    ];

  }
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

