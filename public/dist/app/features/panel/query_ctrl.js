import _ from 'lodash';
var QueryCtrl = /** @class */ (function () {
    function QueryCtrl($scope, $injector) {
        this.$scope = $scope;
        this.$injector = $injector;
        this.panel = this.panelCtrl.panel;
        this.isLastQuery = _.indexOf(this.panel.targets, this.target) === this.panel.targets.length - 1;
    }
    QueryCtrl.prototype.refresh = function () {
        this.panelCtrl.refresh();
    };
    return QueryCtrl;
}());
export { QueryCtrl };
//# sourceMappingURL=query_ctrl.js.map