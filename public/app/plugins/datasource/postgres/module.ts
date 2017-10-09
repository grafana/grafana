///<reference path="../../../headers/common.d.ts" />

import {PostgresDatasource} from './datasource';
import {PostgresQueryCtrl} from './query_ctrl';

class PostgresConfigCtrl {
  static templateUrl = 'partials/config.html';

  current: any;
  constructor($scope) {
    this.current.jsonData.sslmode = this.current.jsonData.sslmode || 'require';
  }
}

const defaultQuery = `SELECT
  extract(epoch from time_column) AS time,
  title_column as title,
  description_column as text
FROM
  metric_table
WHERE
  $__timeFilter(time_column)
`;

class PostgresAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';

  annotation: any;

  /** @ngInject **/
  constructor() {
    this.annotation.rawQuery = this.annotation.rawQuery || defaultQuery;
  }
}

export {
  PostgresDatasource,
  PostgresDatasource as Datasource,
  PostgresQueryCtrl as QueryCtrl,
  PostgresConfigCtrl as ConfigCtrl,
  PostgresAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};

