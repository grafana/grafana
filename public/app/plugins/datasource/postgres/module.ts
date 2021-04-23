import { PostgresDatasource } from './datasource';
import { PostgresQueryCtrl } from './query_ctrl';
import { PostgresConfigCtrl } from './config_ctrl';

const defaultQuery = `SELECT
  extract(epoch from time_column) AS time,
  text_column as text,
  tags_column as tags
FROM
  metric_table
WHERE
  $__timeFilter(time_column)
`;

class PostgresAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';

  declare annotation: any;

  /** @ngInject */
  constructor($scope: any) {
    this.annotation = $scope.ctrl.annotation;
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
