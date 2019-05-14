import { MssqlDatasource } from './datasource';
import { MssqlQueryCtrl } from './query_ctrl';
import { MssqlConfigCtrl } from './config_ctrl';
var defaultQuery = "SELECT\n    <time_column> as time,\n    <text_column> as text,\n    <tags_column> as tags\n  FROM\n    <table name>\n  WHERE\n    $__timeFilter(time_column)\n  ORDER BY\n    <time_column> ASC";
var MssqlAnnotationsQueryCtrl = /** @class */ (function () {
    /** @ngInject */
    function MssqlAnnotationsQueryCtrl() {
        this.annotation.rawQuery = this.annotation.rawQuery || defaultQuery;
    }
    MssqlAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return MssqlAnnotationsQueryCtrl;
}());
export { MssqlDatasource, MssqlDatasource as Datasource, MssqlQueryCtrl as QueryCtrl, MssqlConfigCtrl as ConfigCtrl, MssqlAnnotationsQueryCtrl as AnnotationsQueryCtrl, };
//# sourceMappingURL=module.js.map