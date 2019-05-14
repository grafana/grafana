import * as tslib_1 from "tslib";
import './query_parameter_ctrl';
import { QueryCtrl } from 'app/plugins/sdk';
var CloudWatchQueryCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(CloudWatchQueryCtrl, _super);
    /** @ngInject */
    function CloudWatchQueryCtrl($scope, $injector) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.aliasSyntax = '{{metric}} {{stat}} {{namespace}} {{region}} {{<dimension name>}}';
        return _this;
    }
    CloudWatchQueryCtrl.templateUrl = 'partials/query.editor.html';
    return CloudWatchQueryCtrl;
}(QueryCtrl));
export { CloudWatchQueryCtrl };
//# sourceMappingURL=query_ctrl.js.map