import InfluxDatasource from './datasource';
import { InfluxQueryCtrl } from './query_ctrl';
var InfluxConfigCtrl = /** @class */ (function () {
    function InfluxConfigCtrl() {
    }
    InfluxConfigCtrl.templateUrl = 'partials/config.html';
    return InfluxConfigCtrl;
}());
var InfluxAnnotationsQueryCtrl = /** @class */ (function () {
    function InfluxAnnotationsQueryCtrl() {
    }
    InfluxAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return InfluxAnnotationsQueryCtrl;
}());
export { InfluxDatasource as Datasource, InfluxQueryCtrl as QueryCtrl, InfluxConfigCtrl as ConfigCtrl, InfluxAnnotationsQueryCtrl as AnnotationsQueryCtrl, };
//# sourceMappingURL=module.js.map