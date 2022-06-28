import { DataSourcePlugin } from '@grafana/data';

import {
  createChangeHandler,
  createResetHandler,
  PasswordFieldEnum,
} from '../../../features/datasources/utils/passwordHandlers';
import { SqlQueryEditor } from '../sql/components/QueryEditor';
import { SQLQuery } from '../sql/types';

import { MySqlDatasource } from './MySqlDatasource';

class MysqlConfigCtrl {
  static templateUrl = 'partials/config.html';
  current: any;
  onPasswordReset: ReturnType<typeof createResetHandler>;
  onPasswordChange: ReturnType<typeof createChangeHandler>;

  constructor() {
    this.onPasswordReset = createResetHandler(this, PasswordFieldEnum.Password);
    this.onPasswordChange = createChangeHandler(this, PasswordFieldEnum.Password);
  }
}

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
  MySqlDatasource,
  MySqlDatasource as Datasource,
  MysqlConfigCtrl as ConfigCtrl,
  MysqlAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};

export const plugin = new DataSourcePlugin<MySqlDatasource, SQLQuery>(MySqlDatasource)
  .setQueryEditor(SqlQueryEditor)
  .setConfigCtrl(MysqlConfigCtrl)
  .setAnnotationQueryCtrl(MysqlAnnotationsQueryCtrl);
