///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import {PostgresDatasource} from './datasource';
import {PostgresQueryCtrl} from './query_ctrl';

class PostgresConfigCtrl {
  static templateUrl = 'partials/config.html';
}

const defaultQuery = `
  SELECT generate_series($__timeFrom(),$__timeTo(),'30s'::interval) AS "time", random() as "value",'random' AS "metric"
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

