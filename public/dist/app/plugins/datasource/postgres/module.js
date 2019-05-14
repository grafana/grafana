import { PostgresDatasource } from './datasource';
import { PostgresQueryCtrl } from './query_ctrl';
import { PostgresConfigCtrl } from './config_ctrl';
var defaultQuery = "SELECT\n  extract(epoch from time_column) AS time,\n  text_column as text,\n  tags_column as tags\nFROM\n  metric_table\nWHERE\n  $__timeFilter(time_column)\n";
var PostgresAnnotationsQueryCtrl = /** @class */ (function () {
    /** @ngInject */
    function PostgresAnnotationsQueryCtrl() {
        this.annotation.rawQuery = this.annotation.rawQuery || defaultQuery;
    }
    PostgresAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return PostgresAnnotationsQueryCtrl;
}());
export { PostgresDatasource, PostgresDatasource as Datasource, PostgresQueryCtrl as QueryCtrl, PostgresConfigCtrl as ConfigCtrl, PostgresAnnotationsQueryCtrl as AnnotationsQueryCtrl, };
//# sourceMappingURL=module.js.map