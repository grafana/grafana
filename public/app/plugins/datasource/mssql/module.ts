///<reference path="../../../headers/common.d.ts" />

import {MssqlDatasource} from './datasource';
import {MssqlQueryCtrl} from './query_ctrl';

class MssqlConfigCtrl {
  static templateUrl = 'partials/config.html';
}

const defaultQuery = `SELECT TOP 100
    $__utcTime(<time_column>),
    <text_column> as text,
    <tags_column> as tags
  FROM <table name>
  WHERE $__timeFilter(time_column)
  ORDER BY <time_column> ASC
  `;

class MssqlAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';

  annotation: any;

  /** @ngInject **/
  constructor() {
    this.annotation.rawQuery = this.annotation.rawQuery || defaultQuery;
  }
}

export {
  MssqlDatasource,
  MssqlDatasource as Datasource,
  MssqlQueryCtrl as QueryCtrl,
  MssqlConfigCtrl as ConfigCtrl,
  MssqlAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};

