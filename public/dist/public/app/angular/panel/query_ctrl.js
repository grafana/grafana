import { indexOf } from 'lodash';
export class QueryCtrl {
    constructor($scope, $injector) {
        var _a, _b, _c, _d, _e;
        this.$scope = $scope;
        this.$injector = $injector;
        this.panelCtrl = (_a = this.panelCtrl) !== null && _a !== void 0 ? _a : $scope.ctrl.panelCtrl;
        this.target = (_b = this.target) !== null && _b !== void 0 ? _b : $scope.ctrl.target;
        this.datasource = (_c = this.datasource) !== null && _c !== void 0 ? _c : $scope.ctrl.datasource;
        this.panel = (_e = (_d = this.panelCtrl) === null || _d === void 0 ? void 0 : _d.panel) !== null && _e !== void 0 ? _e : $scope.ctrl.panelCtrl.panel;
        this.isLastQuery = indexOf(this.panel.targets, this.target) === this.panel.targets.length - 1;
    }
    refresh() {
        this.panelCtrl.refresh();
    }
}
//# sourceMappingURL=query_ctrl.js.map