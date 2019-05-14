import coreModule from 'app/core/core_module';
var template = "\n<div class=\"modal-body\">\n  <div class=\"modal-header\">\n    <h2 class=\"modal-header-title\">\n      <i class=\"fa fa-save\"></i>\n      <span class=\"p-l-1\">Save changes</span>\n    </h2>\n\n    <a class=\"modal-header-close\" ng-click=\"ctrl.dismiss();\">\n      <i class=\"fa fa-remove\"></i>\n    </a>\n  </div>\n\n  <form name=\"ctrl.saveForm\" ng-submit=\"ctrl.save()\" class=\"modal-content\" novalidate>\n    <div class=\"p-t-1\">\n      <div class=\"gf-form-group\" ng-if=\"ctrl.timeChange || ctrl.variableValueChange\">\n\t\t    <gf-form-switch class=\"gf-form\"\n\t\t\t    label=\"Save current time range\" ng-if=\"ctrl.timeChange\" label-class=\"width-12\" switch-class=\"max-width-6\"\n\t\t\t    checked=\"ctrl.saveTimerange\" on-change=\"buildUrl()\">\n\t\t    </gf-form-switch>\n\t\t    <gf-form-switch class=\"gf-form\"\n\t\t\t    label=\"Save current variables\" ng-if=\"ctrl.variableValueChange\" label-class=\"width-12\" switch-class=\"max-width-6\"\n\t\t\t    checked=\"ctrl.saveVariables\" on-change=\"buildUrl()\">\n\t\t    </gf-form-switch>\n\t    </div>\n      <div class=\"gf-form\">\n        <label class=\"gf-form-hint\">\n          <input\n            type=\"text\"\n            name=\"message\"\n            class=\"gf-form-input\"\n            placeholder=\"Add a note to describe your changes &hellip;\"\n            give-focus=\"true\"\n            ng-model=\"ctrl.message\"\n            ng-model-options=\"{allowInvalid: true}\"\n            ng-maxlength=\"this.max\"\n            maxlength=\"64\"\n            autocomplete=\"off\" />\n          <small class=\"gf-form-hint-text muted\" ng-cloak>\n            <span ng-class=\"{'text-error': ctrl.saveForm.message.$invalid && ctrl.saveForm.message.$dirty }\">\n              {{ctrl.message.length || 0}}\n            </span>\n            / {{ctrl.max}} characters\n          </small>\n        </label>\n      </div>\n    </div>\n\n    <div class=\"gf-form-button-row text-center\">\n      <button\n        id=\"saveBtn\"\n        type=\"submit\"\n        class=\"btn btn-primary\"\n        ng-class=\"{'btn-primary--processing': ctrl.isSaving}\"\n        ng-disabled=\"ctrl.saveForm.$invalid || ctrl.isSaving\"\n      >\n        <span ng-if=\"!ctrl.isSaving\">Save</span>\n        <span ng-if=\"ctrl.isSaving === true\">Saving...</span>\n      </button>\n      <button class=\"btn btn-inverse\" ng-click=\"ctrl.dismiss();\">Cancel</button>\n    </div>\n  </form>\n</div>\n";
var SaveDashboardModalCtrl = /** @class */ (function () {
    /** @ngInject */
    function SaveDashboardModalCtrl(dashboardSrv) {
        this.dashboardSrv = dashboardSrv;
        this.saveVariables = false;
        this.saveTimerange = false;
        this.current = [];
        this.originalCurrent = [];
        this.timeChange = false;
        this.variableValueChange = false;
        this.message = '';
        this.max = 64;
        this.isSaving = false;
        this.timeChange = this.dashboardSrv.getCurrent().hasTimeChanged();
        this.variableValueChange = this.dashboardSrv.getCurrent().hasVariableValuesChanged();
    }
    SaveDashboardModalCtrl.prototype.save = function () {
        if (!this.saveForm.$valid) {
            return;
        }
        var options = {
            saveVariables: this.saveVariables,
            saveTimerange: this.saveTimerange,
            message: this.message,
        };
        var dashboard = this.dashboardSrv.getCurrent();
        var saveModel = dashboard.getSaveModelClone(options);
        this.isSaving = true;
        return this.dashboardSrv.save(saveModel, options).then(this.postSave.bind(this, options));
    };
    SaveDashboardModalCtrl.prototype.postSave = function (options) {
        if (options.saveVariables) {
            this.dashboardSrv.getCurrent().resetOriginalVariables();
        }
        if (options.saveTimerange) {
            this.dashboardSrv.getCurrent().resetOriginalTime();
        }
        this.dismiss();
    };
    return SaveDashboardModalCtrl;
}());
export { SaveDashboardModalCtrl };
export function saveDashboardModalDirective() {
    return {
        restrict: 'E',
        template: template,
        controller: SaveDashboardModalCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: { dismiss: '&' },
    };
}
coreModule.directive('saveDashboardModal', saveDashboardModalDirective);
//# sourceMappingURL=SaveDashboardModalCtrl.js.map