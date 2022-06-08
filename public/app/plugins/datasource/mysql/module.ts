import { DataSourcePlugin } from '@grafana/data';

import { ConfigurationEditor } from './configuration/ConfigurationEditor';
import { MysqlDatasource } from './datasource';
import { MysqlQueryCtrl } from './query_ctrl';
import { MySQLQuery } from './types';

const defaultQuery = `SELECT
    UNIX_TIMESTAMP(<time_column>) as time_sec,
    <text_column> as text,
    <tags_column> as tags
  FROM <table name>
  WHERE $__timeFilter(time_column)
  ORDER BY <time_column> ASC
  LIMIT 100
  `;

class MysqlAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';

  declare annotation: any;

  /** @ngInject */
  constructor($scope: any) {
    this.annotation = $scope.ctrl.annotation;
    this.annotation.rawQuery = this.annotation.rawQuery || defaultQuery;
  }
}

export {
  MysqlDatasource,
  MysqlDatasource as Datasource,
  MysqlQueryCtrl as QueryCtrl,
  MysqlAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};

export const plugin = new DataSourcePlugin<MysqlDatasource, MySQLQuery>(MysqlDatasource)
  .setQueryCtrl(MysqlQueryCtrl)
  .setConfigEditor(ConfigurationEditor)
  .setAnnotationQueryCtrl(MysqlAnnotationsQueryCtrl);
