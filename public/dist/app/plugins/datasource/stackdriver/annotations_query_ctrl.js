var StackdriverAnnotationsQueryCtrl = /** @class */ (function () {
    /** @ngInject */
    function StackdriverAnnotationsQueryCtrl(templateSrv) {
        this.templateSrv = templateSrv;
        this.annotation.target = this.annotation.target || {};
        this.onQueryChange = this.onQueryChange.bind(this);
    }
    StackdriverAnnotationsQueryCtrl.prototype.onQueryChange = function (target) {
        Object.assign(this.annotation.target, target);
    };
    StackdriverAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return StackdriverAnnotationsQueryCtrl;
}());
export { StackdriverAnnotationsQueryCtrl };
//# sourceMappingURL=annotations_query_ctrl.js.map