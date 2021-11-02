/**
 * Just a simple wrapper for a react component that is actually implementing the query editor.
 */
var LokiAnnotationsQueryCtrl = /** @class */ (function () {
    /** @ngInject */
    function LokiAnnotationsQueryCtrl($scope) {
        this.annotation = $scope.ctrl.annotation;
        this.annotation.target = this.annotation.target || {};
        this.onQueryChange = this.onQueryChange.bind(this);
    }
    LokiAnnotationsQueryCtrl.prototype.onQueryChange = function (query) {
        this.annotation.expr = query.expr;
        this.annotation.maxLines = query.maxLines;
        this.annotation.instant = query.instant;
    };
    LokiAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return LokiAnnotationsQueryCtrl;
}());
export { LokiAnnotationsQueryCtrl };
//# sourceMappingURL=LokiAnnotationsQueryCtrl.js.map