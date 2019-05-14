var QueryCtrl = /** @class */ (function () {
    function QueryCtrl($scope, _$injector) {
        this.$scope = $scope;
        this.panelCtrl = this.panelCtrl || { panel: {} };
        this.target = this.target || { target: '' };
        this.panel = this.panelCtrl.panel;
    }
    QueryCtrl.prototype.refresh = function () { };
    return QueryCtrl;
}());
export { QueryCtrl };
//# sourceMappingURL=query_ctrl.js.map