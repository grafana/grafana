import { coreModule } from 'app/core/core';
var RowOptionsCtrl = /** @class */ (function () {
    /** @ngInject */
    function RowOptionsCtrl() {
        this.source = this.row;
        this.row = this.row.getSaveModel();
    }
    RowOptionsCtrl.prototype.update = function () {
        this.source.title = this.row.title;
        this.source.repeat = this.row.repeat;
        this.onUpdated();
        this.dismiss();
    };
    return RowOptionsCtrl;
}());
export { RowOptionsCtrl };
export function rowOptionsDirective() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/features/dashboard/components/RowOptions/template.html',
        controller: RowOptionsCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            row: '=',
            dismiss: '&',
            onUpdated: '&',
        },
    };
}
coreModule.directive('rowOptions', rowOptionsDirective);
//# sourceMappingURL=RowOptionsCtrl.js.map