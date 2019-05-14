import * as tslib_1 from "tslib";
import { QueryCtrl } from 'app/plugins/sdk';
var StackdriverQueryCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(StackdriverQueryCtrl, _super);
    /** @ngInject */
    function StackdriverQueryCtrl($scope, $injector, templateSrv) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.templateSrv = templateSrv;
        _this.onQueryChange = _this.onQueryChange.bind(_this);
        _this.onExecuteQuery = _this.onExecuteQuery.bind(_this);
        return _this;
    }
    StackdriverQueryCtrl.prototype.onQueryChange = function (target) {
        Object.assign(this.target, target);
    };
    StackdriverQueryCtrl.prototype.onExecuteQuery = function () {
        this.$scope.ctrl.refresh();
    };
    StackdriverQueryCtrl.templateUrl = 'partials/query.editor.html';
    return StackdriverQueryCtrl;
}(QueryCtrl));
export { StackdriverQueryCtrl };
//# sourceMappingURL=query_ctrl.js.map