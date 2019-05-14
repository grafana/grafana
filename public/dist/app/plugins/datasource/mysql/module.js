import { MysqlDatasource } from './datasource';
import { MysqlQueryCtrl } from './query_ctrl';
var MysqlConfigCtrl = /** @class */ (function () {
    function MysqlConfigCtrl() {
    }
    MysqlConfigCtrl.templateUrl = 'partials/config.html';
    return MysqlConfigCtrl;
}());
var defaultQuery = "SELECT\n    UNIX_TIMESTAMP(<time_column>) as time_sec,\n    <text_column> as text,\n    <tags_column> as tags\n  FROM <table name>\n  WHERE $__timeFilter(time_column)\n  ORDER BY <time_column> ASC\n  LIMIT 100\n  ";
var MysqlAnnotationsQueryCtrl = /** @class */ (function () {
    /** @ngInject */
    function MysqlAnnotationsQueryCtrl() {
        this.annotation.rawQuery = this.annotation.rawQuery || defaultQuery;
    }
    MysqlAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return MysqlAnnotationsQueryCtrl;
}());
export { MysqlDatasource, MysqlDatasource as Datasource, MysqlQueryCtrl as QueryCtrl, MysqlConfigCtrl as ConfigCtrl, MysqlAnnotationsQueryCtrl as AnnotationsQueryCtrl, };
//# sourceMappingURL=module.js.map