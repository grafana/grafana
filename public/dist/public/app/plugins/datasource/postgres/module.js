import { PostgresDatasource } from './datasource';
import { PostgresQueryCtrl } from './query_ctrl';
import { PostgresConfigCtrl } from './config_ctrl';
import { DataSourcePlugin } from '@grafana/data';
var defaultQuery = "SELECT\n  extract(epoch from time_column) AS time,\n  text_column as text,\n  tags_column as tags\nFROM\n  metric_table\nWHERE\n  $__timeFilter(time_column)\n";
var PostgresAnnotationsQueryCtrl = /** @class */ (function () {
    /** @ngInject */
    function PostgresAnnotationsQueryCtrl($scope) {
        this.annotation = $scope.ctrl.annotation;
        this.annotation.rawQuery = this.annotation.rawQuery || defaultQuery;
    }
    PostgresAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return PostgresAnnotationsQueryCtrl;
}());
export var plugin = new DataSourcePlugin(PostgresDatasource)
    .setQueryCtrl(PostgresQueryCtrl)
    .setConfigCtrl(PostgresConfigCtrl)
    .setAnnotationQueryCtrl(PostgresAnnotationsQueryCtrl);
//# sourceMappingURL=module.js.map