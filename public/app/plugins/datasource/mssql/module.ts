import { MssqlDatasource } from './datasource';
import { MssqlQueryCtrl } from './query_ctrl';
import { MssqlConfigCtrl } from './config_ctrl';
import { MssqlQuery } from './types';
import { DataSourcePlugin } from '@grafana/data';

const defaultQuery = `SELECT
    <time_column> as time,
    <text_column> as text,
    <tags_column> as tags
  FROM
    <table name>
  WHERE
    $__timeFilter(time_column)
  ORDER BY
    <time_column> ASC`;

class MssqlAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';

  declare annotation: any;

  /** @ngInject */
  constructor($scope: any) {
    this.annotation = $scope.ctrl.annotation;
    this.annotation.rawQuery = this.annotation.rawQuery || defaultQuery;
  }
}

export const plugin = new DataSourcePlugin<MssqlDatasource, MssqlQuery>(MssqlDatasource)
  .setQueryCtrl(MssqlQueryCtrl)
  .setConfigCtrl(MssqlConfigCtrl)
  .setAnnotationQueryCtrl(MssqlAnnotationsQueryCtrl);
