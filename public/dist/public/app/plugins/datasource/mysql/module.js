import { MysqlDatasource } from './datasource';
import { MysqlQueryCtrl } from './query_ctrl';
import { createChangeHandler, createResetHandler, PasswordFieldEnum, } from '../../../features/datasources/utils/passwordHandlers';
import { DataSourcePlugin } from '@grafana/data';
var MysqlConfigCtrl = /** @class */ (function () {
    function MysqlConfigCtrl() {
        this.onPasswordReset = createResetHandler(this, PasswordFieldEnum.Password);
        this.onPasswordChange = createChangeHandler(this, PasswordFieldEnum.Password);
    }
    MysqlConfigCtrl.templateUrl = 'partials/config.html';
    return MysqlConfigCtrl;
}());
var defaultQuery = "SELECT\n    UNIX_TIMESTAMP(<time_column>) as time_sec,\n    <text_column> as text,\n    <tags_column> as tags\n  FROM <table name>\n  WHERE $__timeFilter(time_column)\n  ORDER BY <time_column> ASC\n  LIMIT 100\n  ";
var MysqlAnnotationsQueryCtrl = /** @class */ (function () {
    /** @ngInject */
    function MysqlAnnotationsQueryCtrl($scope) {
        this.annotation = $scope.ctrl.annotation;
        this.annotation.rawQuery = this.annotation.rawQuery || defaultQuery;
    }
    MysqlAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return MysqlAnnotationsQueryCtrl;
}());
export { MysqlDatasource, MysqlDatasource as Datasource, MysqlQueryCtrl as QueryCtrl, MysqlConfigCtrl as ConfigCtrl, MysqlAnnotationsQueryCtrl as AnnotationsQueryCtrl, };
export var plugin = new DataSourcePlugin(MysqlDatasource)
    .setQueryCtrl(MysqlQueryCtrl)
    .setConfigCtrl(MysqlConfigCtrl)
    .setAnnotationQueryCtrl(MysqlAnnotationsQueryCtrl);
//# sourceMappingURL=module.js.map