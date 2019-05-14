import coreModule from 'app/core/core_module';
var template = "\n<div class=\"modal-body\">\n  <div class=\"modal-header\">\n    <h2 class=\"modal-header-title\">\n      <i class=\"fa fa-exclamation\"></i>\n      <span class=\"p-l-1\">Unsaved changes</span>\n    </h2>\n\n    <a class=\"modal-header-close\" ng-click=\"ctrl.dismiss();\">\n      <i class=\"fa fa-remove\"></i>\n    </a>\n  </div>\n\n  <div class=\"modal-content text-center\">\n\n    <div class=\"confirm-modal-text\">\n      Do you want to save your changes?\n    </div>\n\n    <div class=\"confirm-modal-buttons\">\n      <button type=\"button\" class=\"btn btn-primary\" ng-click=\"ctrl.save()\">Save</button>\n      <button type=\"button\" class=\"btn btn-danger\" ng-click=\"ctrl.discard()\">Discard</button>\n      <button type=\"button\" class=\"btn btn-inverse\" ng-click=\"ctrl.dismiss()\">Cancel</button>\n    </div>\n  </div>\n</div>\n";
var UnsavedChangesModalCtrl = /** @class */ (function () {
    /** @ngInject */
    function UnsavedChangesModalCtrl(unsavedChangesSrv) {
        this.unsavedChangesSrv = unsavedChangesSrv;
    }
    UnsavedChangesModalCtrl.prototype.discard = function () {
        this.dismiss();
        this.unsavedChangesSrv.tracker.discardChanges();
    };
    UnsavedChangesModalCtrl.prototype.save = function () {
        this.dismiss();
        this.unsavedChangesSrv.tracker.saveChanges();
    };
    return UnsavedChangesModalCtrl;
}());
export { UnsavedChangesModalCtrl };
export function unsavedChangesModalDirective() {
    return {
        restrict: 'E',
        template: template,
        controller: UnsavedChangesModalCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: { dismiss: '&' },
    };
}
coreModule.directive('unsavedChangesModal', unsavedChangesModalDirective);
//# sourceMappingURL=UnsavedChangesModalCtrl.js.map