var CloudMonitoringAnnotationsQueryCtrl = /** @class */ (function () {
    /** @ngInject */
    function CloudMonitoringAnnotationsQueryCtrl($scope) {
        this.annotation = $scope.ctrl.annotation || {};
        this.annotation.target = $scope.ctrl.annotation.target || {};
        this.onQueryChange = this.onQueryChange.bind(this);
    }
    CloudMonitoringAnnotationsQueryCtrl.prototype.onQueryChange = function (target) {
        Object.assign(this.annotation.target, target);
    };
    CloudMonitoringAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return CloudMonitoringAnnotationsQueryCtrl;
}());
export { CloudMonitoringAnnotationsQueryCtrl };
//# sourceMappingURL=annotations_query_ctrl.js.map