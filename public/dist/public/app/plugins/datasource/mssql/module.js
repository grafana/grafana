import { MssqlDatasource } from './datasource';
import { MssqlQueryCtrl } from './query_ctrl';
import { MssqlConfigCtrl } from './config_ctrl';
import { DataSourcePlugin } from '@grafana/data';
var defaultQuery = "SELECT\n    <time_column> as time,\n    <text_column> as text,\n    <tags_column> as tags\n  FROM\n    <table name>\n  WHERE\n    $__timeFilter(time_column)\n  ORDER BY\n    <time_column> ASC";
var MssqlAnnotationsQueryCtrl = /** @class */ (function () {
    /** @ngInject */
    function MssqlAnnotationsQueryCtrl($scope) {
        this.annotation = $scope.ctrl.annotation;
        this.annotation.rawQuery = this.annotation.rawQuery || defaultQuery;
    }
    MssqlAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return MssqlAnnotationsQueryCtrl;
}());
export var plugin = new DataSourcePlugin(MssqlDatasource)
    .setQueryCtrl(MssqlQueryCtrl)
    .setConfigCtrl(MssqlConfigCtrl)
    .setAnnotationQueryCtrl(MssqlAnnotationsQueryCtrl);
//# sourceMappingURL=module.js.map